require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const express = require('express');
const cors = require('cors');
const { Pool } = require('pg');

// ============================================
// CONFIGURATION
// ============================================

const BOT_TOKEN = process.env.BOT_TOKEN || '8058613608:AAEm-S2-LfhFLCw4yK-5VBjqJyViwkd1bOk';
const WEB_APP_URL = process.env.WEB_APP_URL || 'https://your-game-url.netlify.app';
const PORT = process.env.PORT || 3000;

// Initialize Bot
const bot = new TelegramBot(BOT_TOKEN, { polling: true });

// Initialize Express
const app = express();
app.use(cors());
app.use(express.json());

// Initialize PostgreSQL (Railway avtomatik DATABASE_URL beradi)
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: process.env.DATABASE_URL ? { rejectUnauthorized: false } : false
});

// Test database connection
pool.query('SELECT NOW()', (err, res) => {
    if (err) {
        console.error('❌ Database connection error:', err.message);
        console.log('⚠️  Bot ishlaydi, lekin database yo\'q (faqat test rejim)');
    } else {
        console.log('✅ Database connected:', res.rows[0].now);
    }
});

// ============================================
// HELPER FUNCTIONS
// ============================================

// Get or create user
async function getOrCreateUser(telegramId, userData = {}) {
    try {
        let result = await pool.query(
            'SELECT * FROM users WHERE telegram_id = $1',
            [telegramId]
        );
        
        if (result.rows.length === 0) {
            result = await pool.query(
                `INSERT INTO users (telegram_id, username, first_name, last_name)
                 VALUES ($1, $2, $3, $4)
                 RETURNING *`,
                [
                    telegramId,
                    userData.username || null,
                    userData.first_name || null,
                    userData.last_name || null
                ]
            );
            console.log(`✨ New user: ${userData.first_name} (${telegramId})`);
        }
        
        return result.rows[0];
    } catch (error) {
        console.error('Database error:', error.message);
        // Return mock user if database fails
        return {
            id: telegramId,
            telegram_id: telegramId,
            username: userData.username,
            first_name: userData.first_name,
            total_coins: 0,
            highest_score: 0,
            games_played: 0
        };
    }
}

// Format number with commas
function formatNumber(num) {
    return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

// ============================================
// API ENDPOINTS
// ============================================

// Health check
app.get('/', (req, res) => {
    res.json({ 
        status: '✅ Bot ishlayapti!',
        bot: '@' + (bot.options.username || 'unknown'),
        time: new Date().toISOString()
    });
});

app.get('/api/health', (req, res) => {
    res.json({ 
        status: 'OK',
        bot: 'NEON Bricks',
        version: '1.0.0',
        timestamp: new Date().toISOString()
    });
});

// Get user data
app.get('/api/user/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await getOrCreateUser(parseInt(telegramId), {});
        res.json(user);
    } catch (error) {
        console.error('Error fetching user:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Start game session
app.post('/api/game/start', async (req, res) => {
    try {
        const { telegramId, difficulty, gameMode, isBossRush } = req.body;
        
        const user = await getOrCreateUser(parseInt(telegramId), {});
        
        const result = await pool.query(
            `INSERT INTO game_sessions (user_id, difficulty, game_mode, is_boss_rush, started_at)
             VALUES ($1, $2, $3, $4, NOW())
             RETURNING id`,
            [user.id, difficulty || 'medium', gameMode || 'normal', isBossRush || false]
        );
        
        res.json({ sessionId: result.rows[0].id });
    } catch (error) {
        console.error('Error starting game:', error);
        res.json({ sessionId: Date.now() }); // Fallback session ID
    }
});

// End game session
app.post('/api/game/end', async (req, res) => {
    try {
        const {
            telegramId,
            sessionId,
            finalScore,
            levelReached,
            coinsEarned,
            bricksDestroyed,
            bossesDefeated,
            duration
        } = req.body;
        
        const user = await getOrCreateUser(parseInt(telegramId), {});
        
        // Update game session
        await pool.query(
            `UPDATE game_sessions 
             SET final_score = $1, level_reached = $2, coins_earned = $3,
                 bricks_destroyed = $4, bosses_defeated = $5, 
                 duration = $6, ended_at = NOW()
             WHERE id = $7`,
            [finalScore, levelReached, coinsEarned, bricksDestroyed || 0, 
             bossesDefeated || 0, duration || 0, sessionId]
        );
        
        // Update user stats
        const isNewHighScore = finalScore > user.highest_score;
        
        await pool.query(
            `UPDATE users 
             SET total_coins = total_coins + $1,
                 total_score = total_score + $2,
                 highest_score = GREATEST(highest_score, $3),
                 highest_level = GREATEST(highest_level, $4),
                 games_played = games_played + 1,
                 total_playtime = total_playtime + $5,
                 bricks_destroyed = bricks_destroyed + $6,
                 bosses_defeated = bosses_defeated + $7,
                 last_played = NOW()
             WHERE id = $8`,
            [coinsEarned, finalScore, finalScore, levelReached,
             duration || 0, bricksDestroyed || 0, bossesDefeated || 0, user.id]
        );
        
        res.json({ 
            success: true,
            isNewHighScore,
            totalCoins: user.total_coins + coinsEarned
        });
    } catch (error) {
        console.error('Error ending game:', error);
        res.json({ success: true, isNewHighScore: false });
    }
});

// Get leaderboard
app.get('/api/leaderboard/:period', async (req, res) => {
    try {
        const { period } = req.params;
        const telegramId = req.query.telegramId;
        
        let query;
        if (period === 'daily') {
            query = `SELECT * FROM leaderboard_daily ORDER BY rank LIMIT 100`;
        } else if (period === 'weekly') {
            query = `SELECT * FROM leaderboard_weekly ORDER BY rank LIMIT 100`;
        } else {
            query = `SELECT * FROM leaderboard_alltime ORDER BY rank LIMIT 100`;
        }
        
        const result = await pool.query(query);
        
        // Get user rank
        let userRank = null;
        if (telegramId) {
            const tableName = `leaderboard_${period}`;
            const userResult = await pool.query(
                `SELECT rank FROM ${tableName} WHERE telegram_id = $1`,
                [telegramId]
            );
            if (userResult.rows.length > 0) {
                userRank = userResult.rows[0].rank;
            }
        }
        
        res.json({
            leaderboard: result.rows,
            userRank,
            period
        });
    } catch (error) {
        console.error('Error fetching leaderboard:', error);
        res.json({ leaderboard: [], userRank: null, period: req.params.period });
    }
});

// Get user stats
app.get('/api/stats/:telegramId', async (req, res) => {
    try {
        const { telegramId } = req.params;
        const user = await getOrCreateUser(parseInt(telegramId), {});
        
        // Get recent sessions
        const sessions = await pool.query(
            `SELECT final_score, level_reached, difficulty, ended_at
             FROM game_sessions
             WHERE user_id = $1
             ORDER BY ended_at DESC
             LIMIT 10`,
            [user.id]
        );
        
        res.json({
            user,
            recentSessions: sessions.rows
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        const user = await getOrCreateUser(parseInt(req.params.telegramId), {});
        res.json({ user, recentSessions: [] });
    }
});

// Update inventory
app.post('/api/user/inventory', async (req, res) => {
    try {
        const { telegramId, inventory } = req.body;
        const user = await getOrCreateUser(parseInt(telegramId), {});
        
        await pool.query(
            'UPDATE users SET inventory = $1 WHERE id = $2',
            [JSON.stringify(inventory), user.id]
        );
        
        res.json({ success: true });
    } catch (error) {
        console.error('Error updating inventory:', error);
        res.json({ success: false });
    }
});

// ============================================
// TELEGRAM BOT COMMANDS
// ============================================

// /start command
bot.onText(/\/start/, async (msg) => {
    const chatId = msg.chat.id;
    const user = await getOrCreateUser(msg.from.id, msg.from);
    
    const welcomeMessage = 
        `🎮 *NEON BRICKS*\n\n` +
        `Salom, ${user.first_name || 'O\'yinchi'}!\n\n` +
        `💰 *Tangalar:* ${formatNumber(user.total_coins || 0)}\n` +
        `🏆 *Eng yuqori ball:* ${formatNumber(user.highest_score || 0)}\n` +
        `🎯 *O'yinlar:* ${user.games_played || 0}\n\n` +
        `O'yinni boshlash uchun tugmani bosing! 👇`;
    
    bot.sendMessage(chatId, welcomeMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { 
                    text: '🎮 O\'YNASH', 
                    web_app: { url: WEB_APP_URL }
                }
            ], [
                { text: '📊 Statistika', callback_data: 'stats' },
                { text: '🏆 Reyting', callback_data: 'leaderboard' }
            ], [
                { text: '❓ Yordam', callback_data: 'help' }
            ]]
        }
    });
});

// /stats command
bot.onText(/\/stats/, async (msg) => {
    const user = await getOrCreateUser(msg.from.id, msg.from);
    
    const avgScore = user.games_played > 0 ? 
        Math.floor((user.total_score || 0) / user.games_played) : 0;
    
    const statsMessage =
        `📊 *Sizning statistikangiz*\n\n` +
        `💰 *Tangalar:* ${formatNumber(user.total_coins || 0)}\n` +
        `🏆 *Eng yuqori ball:* ${formatNumber(user.highest_score || 0)}\n` +
        `📈 *Jami ball:* ${formatNumber(user.total_score || 0)}\n` +
        `🎯 *O'yinlar:* ${user.games_played || 0}\n` +
        `📊 *O'rtacha ball:* ${formatNumber(avgScore)}\n` +
        `🧱 *Buzilgan bloklar:* ${formatNumber(user.bricks_destroyed || 0)}\n` +
        `👾 *Boss'lar:* ${user.bosses_defeated || 0}`;
    
    bot.sendMessage(msg.chat.id, statsMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '🎮 O\'ynash', web_app: { url: WEB_APP_URL } }
            ]]
        }
    });
});

// /leaderboard command
bot.onText(/\/leaderboard/, async (msg) => {
    bot.sendMessage(msg.chat.id, 
        '🏆 *Reyting*\n\nQaysi reytingni ko\'rmoqchisiz?', {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '📅 Kunlik', callback_data: 'lb_daily' },
                { text: '📆 Haftalik', callback_data: 'lb_weekly' }
            ], [
                { text: '🏅 Umumiy', callback_data: 'lb_alltime' }
            ]]
        }
    });
});

// /help command
bot.onText(/\/help/, (msg) => {
    const helpMessage =
        `🎮 *NEON BRICKS - Yordam*\n\n` +
        `*O'yin qoidalari:*\n` +
        `🎯 Barcha bloklarni buzing\n` +
        `💎 Bonuslarni yig'ing\n` +
        `💰 Tangalar yig'ib do'konga boring\n` +
        `👾 Har 5-levelda boss bor\n\n` +
        `*Buyruqlar:*\n` +
        `/start - Boshlanish\n` +
        `/stats - Statistika\n` +
        `/leaderboard - Reyting\n` +
        `/help - Yordam\n\n` +
        `*Cheat kodlar:*\n` +
        `🔑 senior - Levelni yutish\n` +
        `🔫 nur - Cheksiz lazer\n` +
        `⚡ god - Cheksiz qalqon\n` +
        `🔥 fire - Doimiy olov\n` +
        `💰 rich - 10,000 tanga`;
    
    bot.sendMessage(msg.chat.id, helpMessage, {
        parse_mode: 'Markdown',
        reply_markup: {
            inline_keyboard: [[
                { text: '🎮 O\'ynash', web_app: { url: WEB_APP_URL } }
            ]]
        }
    });
});

// Handle callback queries
bot.on('callback_query', async (query) => {
    const chatId = query.message.chat.id;
    const data = query.data;
    
    bot.answerCallbackQuery(query.id);
    
    if (data === 'stats') {
        const user = await getOrCreateUser(query.from.id, query.from);
        
        const statsMessage =
            `📊 *Statistika*\n\n` +
            `💰 Tangalar: ${formatNumber(user.total_coins || 0)}\n` +
            `🏆 Eng yuqori: ${formatNumber(user.highest_score || 0)}\n` +
            `🎯 O'yinlar: ${user.games_played || 0}`;
        
        bot.sendMessage(chatId, statsMessage, { parse_mode: 'Markdown' });
    }
    else if (data === 'leaderboard') {
        bot.sendMessage(chatId, 
            '🏆 Qaysi reytingni ko\'rmoqchisiz?', {
            reply_markup: {
                inline_keyboard: [[
                    { text: '📅 Kunlik', callback_data: 'lb_daily' }
                ], [
                    { text: '📆 Haftalik', callback_data: 'lb_weekly' }
                ], [
                    { text: '🏅 Umumiy', callback_data: 'lb_alltime' }
                ]]
            }
        });
    }
    else if (data.startsWith('lb_')) {
        const period = data.replace('lb_', '');
        
        try {
            let tableName = period === 'daily' ? 'leaderboard_daily' :
                           period === 'weekly' ? 'leaderboard_weekly' : 
                           'leaderboard_alltime';
            
            const result = await pool.query(
                `SELECT * FROM ${tableName} LIMIT 10`
            );
            
            let periodName = period === 'daily' ? '📅 Kunlik' : 
                           period === 'weekly' ? '📆 Haftalik' : '🏅 Umumiy';
            
            let message = `🏆 *${periodName} Reyting*\n\n`;
            
            if (result.rows.length === 0) {
                message += 'Hozircha ma\'lumot yo\'q.';
            } else {
                result.rows.forEach((player, index) => {
                    const medal = index === 0 ? '🥇' : 
                                 index === 1 ? '🥈' : 
                                 index === 2 ? '🥉' : `${index + 1}.`;
                    const name = player.username || player.first_name || 'Anonim';
                    const score = period === 'daily' ? player.daily_score :
                                 period === 'weekly' ? player.weekly_score :
                                 player.highest_score;
                    
                    message += `${medal} *${name}* - ${formatNumber(score)}\n`;
                });
            }
            
            bot.sendMessage(chatId, message, {
                parse_mode: 'Markdown',
                reply_markup: {
                    inline_keyboard: [[
                        { text: '🎮 O\'ynash', web_app: { url: WEB_APP_URL } }
                    ]]
                }
            });
        } catch (error) {
            bot.sendMessage(chatId, 
                '❌ Reytingni yuklashda xatolik.\n\n' +
                'Database hali sozlanmagan bo\'lishi mumkin.');
        }
    }
    else if (data === 'help') {
        bot.processUpdate({ 
            message: { text: '/help', chat: { id: chatId }, from: query.from } 
        });
    }
});

// ============================================
// START SERVER
// ============================================

app.listen(PORT, () => {
    console.log('\n╔══════════════════════════════════════════════════════════╗');
    console.log('║          🎮 NEON BRICKS BOT ISHGA TUSHDI! 🎮           ║');
    console.log('╚══════════════════════════════════════════════════════════╝\n');
    console.log(`✅ API server: http://localhost:${PORT}`);
    console.log(`✅ Bot: @${bot.options.username || 'unknown'}`);
    console.log(`✅ Web App: ${WEB_APP_URL}`);
    console.log(`✅ Database: ${process.env.DATABASE_URL ? 'Connected' : 'Not configured (test mode)'}\n`);
    console.log('Bot tayyor! Telegram\'da /start yuboring.\n');
});

// Error handling
bot.on('polling_error', (error) => {
    console.error('❌ Bot error:', error.message);
});

process.on('SIGINT', async () => {
    console.log('\n\n👋 Bot to\'xtatilmoqda...');
    bot.stopPolling();
    await pool.end();
    process.exit(0);
});
