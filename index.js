const express = require("express");
const app = express();

const DEFAULT_USER = "Blunderexpert_yt"; // your username

function cleanUsername(user) {
    if (
        !user ||
        user.trim() === "" ||
        user.toLowerCase() === "null" ||
        user.toLowerCase() === "undefined"
    ) {
        return DEFAULT_USER;
    }
    return user.toLowerCase();
}

async function getStats(username) {
    const response = await fetch(
        `https://api.chess.com/pub/player/${username}/stats`
    );

    if (!response.ok) return null;

    return await response.json();
}

function totalGames(mode) {
    if (!mode || !mode.record) return 0;

    const wins = mode.record.win || 0;
    const losses = mode.record.loss || 0;
    const draws = mode.record.draw || 0;

    return wins + losses + draws;
}

// ALL RATINGS + PEAKS
app.get("/rating", async (req, res) => {
    const username = cleanUsername(req.query.user);
    const data = await getStats(username);

    if (!data) return res.send("Player not found.");

    const rapid = data.chess_rapid?.last?.rating ?? "N/A";
    const rapidPeak = data.chess_rapid?.best?.rating ?? "N/A";

    const blitz = data.chess_blitz?.last?.rating ?? "N/A";
    const blitzPeak = data.chess_blitz?.best?.rating ?? "N/A";

    const bullet = data.chess_bullet?.last?.rating ?? "N/A";
    const bulletPeak = data.chess_bullet?.best?.rating ?? "N/A";

    res.send(
        `♟️ ${username} → Rapid: ${rapid} (Peak ${rapidPeak}) | Blitz: ${blitz} (Peak ${blitzPeak}) | Bullet: ${bullet} (Peak ${bulletPeak})`
    );
});

app.get("/games", async (req, res) => {
    const username = cleanUsername(req.query.user);
    const data = await getStats(username);

    if (!data) return res.send("Player not found.");

    const rapid = totalGames(data.chess_rapid);
    const blitz = totalGames(data.chess_blitz);
    const bullet = totalGames(data.chess_bullet);
    const daily = totalGames(data.chess_daily);
    const chess960 = totalGames(data.chess960_daily);

    const total = rapid + blitz + bullet + daily + chess960;

    res.send(
        `🎮 ${username} → Rapid: ${rapid} | Blitz: ${blitz} | Bullet: ${bullet} | Daily: ${daily} | 960: ${chess960} | Total: ${total}`
    );
});

app.get("/compare", async (req, res) => {
    const users = req.query.users;

    if (!users) {
        return res.send("Use: !compare username1 username2");
    }

    const usernames = users.trim().split(/\s+/);

    if (usernames.length < 2) {
        return res.send("Please provide 2 usernames.");
    }

    const user1 = cleanUsername(usernames[0]);
    const user2 = cleanUsername(usernames[1]);

    const data1 = await getStats(user1);
    const data2 = await getStats(user2);

    if (!data1 || !data2) {
        return res.send("One or both players were not found.");
    }

    const rapid1 = data1.chess_rapid?.last?.rating ?? "N/A";
    const rapid2 = data2.chess_rapid?.last?.rating ?? "N/A";

    const blitz1 = data1.chess_blitz?.last?.rating ?? "N/A";
    const blitz2 = data2.chess_blitz?.last?.rating ?? "N/A";

    const bullet1 = data1.chess_bullet?.last?.rating ?? "N/A";
    const bullet2 = data2.chess_bullet?.last?.rating ?? "N/A";

    res.send(
        `♟️ ${user1} vs ${user2} → Rapid: ${rapid1} vs ${rapid2} | Blitz: ${blitz1} vs ${blitz2} | Bullet: ${bullet1} vs ${bullet2}`
    );
});


// ===============================
// CHESS.COM HEAD-TO-HEAD
// ===============================

// Cache Chess.com responses for 10 minutes
const h2hCache = new Map();
const H2H_CACHE_TIME = 10 * 60 * 1000;

// Fetch Chess.com API data
async function getChessComJson(url) {
    const cached = h2hCache.get(url);

    if (cached && Date.now() - cached.time < H2H_CACHE_TIME) {
        return cached.data;
    }

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "BlunderexpertChessBot/1.0"
            }
        });

        if (!response.ok) return null;

        const data = await response.json();

        h2hCache.set(url, {
            data,
            time: Date.now()
        });

        return data;

    } catch (error) {
        console.error("Chess.com API error:", error.message);
        return null;
    }
}

// Identify the game result
function getGameOutcome(game) {
    const whiteResult = (game.white?.result || "").toLowerCase();
    const blackResult = (game.black?.result || "").toLowerCase();

    if (whiteResult === "win") return "white";
    if (blackResult === "win") return "black";

    const pgnResult = game.pgn?.match(
        /\[Result\s+"(1-0|0-1|1\/2-1\/2|\*)"\]/
    )?.[1];

    if (pgnResult === "1-0") return "white";
    if (pgnResult === "0-1") return "black";
    if (pgnResult === "1/2-1/2") return "draw";

    const drawResults = [
        "agreed",
        "repetition",
        "stalemate",
        "insufficient",
        "50move",
        "timevsinsufficient",
        "draw"
    ];

    if (
        drawResults.includes(whiteResult) ||
        drawResults.includes(blackResult)
    ) {
        return "draw";
    }

    return null;
}

// HEAD-TO-HEAD ROUTE
app.get("/h2h", async (req, res) => {

    const users = req.query.users;

    if (!users) {
        return res.send("Use: !h2h username1 username2");
    }

    const usernames = users.trim().split(/\s+/);

    if (usernames.length < 2) {
        return res.send("Please provide two Chess.com usernames.");
    }

    const player1 = usernames[0].replace(/^@/, "").toLowerCase();
    const player2 = usernames[1].replace(/^@/, "").toLowerCase();

    const validUsername = /^[a-z0-9_-]{3,25}$/;

    if (!validUsername.test(player1) || !validUsername.test(player2)) {
        return res.send("Invalid Chess.com username.");
    }

    if (player1 === player2) {
        return res.send("Please enter two different usernames.");
    }

    try {

        // Get both players' archive lists
        const archiveData1 = await getChessComJson(
            `https://api.chess.com/pub/player/${encodeURIComponent(player1)}/games/archives`
        );

        const archiveData2 = await getChessComJson(
            `https://api.chess.com/pub/player/${encodeURIComponent(player2)}/games/archives`
        );

        if (!archiveData1 || !archiveData2) {
            return res.status(502).send(
                "Could not retrieve Chess.com archives. Try again later."
            );
        }

        // Find months available in both players' archives
        const player2Months = new Set(
            (archiveData2.archives || [])
                .map(url => url.match(/\/games\/(\d{4}\/\d{2})$/)?.[1])
                .filter(Boolean)
        );

        const archives = (archiveData1.archives || []).filter(url => {
            const month = url.match(/\/games\/(\d{4}\/\d{2})$/)?.[1];
            return month && player2Months.has(month);
        });

        if (archives.length === 0) {
            return res.send(
                `No shared Chess.com archive months found for ${player1} and ${player2}.`
            );
        }

        let player1Wins = 0;
        let player2Wins = 0;
        let draws = 0;
        let matchedGames = 0;

        // Check each shared monthly archive
        for (const archiveUrl of archives) {

            const month = await getChessComJson(archiveUrl);

            if (!month) {
                return res.status(502).send(
                    "Chess.com archive lookup was incomplete. Try again later."
                );
            }

            for (const game of (month.games || [])) {

                // Standard chess only
                if (game.rules && game.rules !== "chess") continue;

                const white = (game.white?.username || "").toLowerCase();
                const black = (game.black?.username || "").toLowerCase();

                const isMatch =
                    (white === player1 && black === player2) ||
                    (white === player2 && black === player1);

                if (!isMatch) continue;

                const outcome = getGameOutcome(game);

                if (!outcome) continue;

                matchedGames++;

                if (outcome === "draw") {
                    draws++;
                } else {
                    const winner = outcome === "white" ? white : black;

                    if (winner === player1) {
                        player1Wins++;
                    } else if (winner === player2) {
                        player2Wins++;
                    }
                }
            }
        }

        if (matchedGames === 0) {
            return res.send(
                `No completed standard chess games found between ${player1} and ${player2} in their available public archives.`
            );
        }

        let leaderMessage;

        if (player1Wins > player2Wins) {
            leaderMessage =
                `🏆 ${player1} leads by ${player1Wins - player2Wins} win(s)!`;
        } else if (player2Wins > player1Wins) {
            leaderMessage =
                `🏆 ${player2} leads by ${player2Wins - player1Wins} win(s)!`;
        } else {
            leaderMessage = "🤝 The head-to-head score is tied!";
        }

        res.send(
            `⚔️ H2H ${player1} vs ${player2} → ` +
            `${player1}: ${player1Wins} wins | ` +
            `${player2}: ${player2Wins} wins | ` +
            `Draws: ${draws} | Total: ${matchedGames} games. ` +
            leaderMessage
        );

    } catch (error) {
        console.error("H2H route error:", error.message);

        res.status(500).send(
            "Something went wrong while checking head-to-head."
        );
    }
});


// ===============================
// FUN HINGLISH COMMANDS
// ===============================

function randomItem(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}


// 🔥 ROAST
app.get("/roast", (req, res) => {
    const username = cleanUsername(req.query.user);

    const roasts = [
        `🔥 ${username} bhai chess khel raha hai ya opponent ko free rating baant raha hai? 😂`,
        `💀 ${username} ka strategy hai: jo mann aaye woh chalo, baad mein sochenge. 😭`,
        `🔥 ${username} blunder nahi karta... bas opponent ko free content deta hai. 😂`,
        `💀 ${username} ka game dekh ke opponent bola: bhai thank you rating ke liye. 😭`,
        `😂 ${username} itna unpredictable hai ki khud ko bhi nahi pata next move kya hoga.`,
        `💀 ${username} ne aaj chess nahi khela... chess ne ${username} ko khela hai.`,
        `🔥 ${username} ka opening dekh ke opponent ne socha: easy rating today. 😂`,
        `😭 ${username} ke pieces bhi bol rahe hain: bhai humein kya karna hai?`,
        `💀 ${username} ka king abhi se retirement plan bana raha hai.`,
        `😂 ${username} move karta hai aur phir khud hi sochta hai: maine ye kyun kiya?`
    ];

    res.send(randomItem(roasts));
});


// 👑 COMPLIMENT
app.get("/compliment", (req, res) => {
    const username = cleanUsername(req.query.user);

    const compliments = [
        `👑 ${username} bhai aaj toh alag hi level pe khel raha hai! 🔥`,
        `😎 ${username} ka aura dekh ke pieces bhi line mein khade ho rahe hain.`,
        `🔥 ${username} aaj full main-character mode mein hai. 👑`,
        `🗿 ${username} ke saamne opponent bhi soch raha hai: bhai ye banda serious hai.`,
        `👑 ${username} bhai aaj toh Grandmaster wali feeling aa rahi hai!`,
        `🔥 ${username} ka game dekh ke lag raha hai practice kaam aa gayi. 😎`,
        `😂 ${username} ke moves mein aaj kuch toh magic hai bhai!`,
        `👑 Chat, aaj ${username} ko challenge karna risky hai. 💀`
    ];

    res.send(randomItem(compliments));
});


// 🗿 AURA
app.get("/aura", (req, res) => {
    const username = cleanUsername(req.query.user);

    const aura = Math.floor(Math.random() * 101);

    let status;

    if (aura >= 90) {
        status = "ILLEGAL LEVELS OF AURA 🔥🗿";
    } else if (aura >= 75) {
        status = "MASSIVE AURA 😎🔥";
    } else if (aura >= 50) {
        status = "DECENT AURA 😏";
    } else if (aura >= 25) {
        status = "AURA THODI KAM HAI 😂";
    } else {
        status = "BHAI AURA GHAR PE BHOOL AAYA KYA? 💀";
    }

    res.send(
        `🗿 ${username} AURA CHECK → ${aura}/100 | ${status}`
    );
});


// 💀 BULLY
app.get("/bully", (req, res) => {
    const username = cleanUsername(req.query.user);

    const bullies = [
        `💀 ${username} bhai bas kar yaar, chess ko itna bhi hurt mat kar.`,
        `😭 ${username} ka king khud bol raha hai: mujhe kyun toda bhai?`,
        `💀 ${username} opponent se zyada apne aap ko bully karta hai.`,
        `😂 ${username} ne opponent ko nahi, apni rating ko checkmate kar diya.`,
        `💀 ${username} ko opponent ki zarurat nahi... khud hi kaafi hai.`,
        `😭 ${username} ka chess dekh ke board bhi bol raha hai: mujhe maaf karo.`,
        `💀 ${username} ke pieces group chat mein uski complaint kar rahe hain.`,
        `😂 ${username} ne aaj chess ko personal bana diya.`,
        `💀 ${username} ka king: bhai mujhe bachana tha, sacrifice kyun kiya?`,
        `😭 ${username} ke moves dekh ke opponent bhi sympathy dene laga.`
    ];

    res.send(randomItem(bullies));
});


// 🍀 LUCK
app.get("/luck", (req, res) => {
    const username = cleanUsername(req.query.user);

    const luck = Math.floor(Math.random() * 101);

    let message;

    if (luck >= 90) {
        message = "Bhai aaj toh kismat full support mein hai! 🍀🔥";
    } else if (luck >= 70) {
        message = "Aaj luck tumhare side hai bhai. 😎🍀";
    } else if (luck >= 40) {
        message = "Normal luck... chess bhi thoda support kar de. 😂";
    } else if (luck >= 15) {
        message = "Bhai aaj kismat thodi naraz hai. 😭";
    } else {
        message = "Aaj toh coin toss bhi opponent ke side hai. 💀";
    }

    res.send(
        `🍀 ${username} Luck: ${luck}% → ${message}`
    );
});


// 👀 SUS
app.get("/sus", (req, res) => {
    const username = cleanUsername(req.query.user);

    const sus = Math.floor(Math.random() * 101);

    let message;

    if (sus >= 90) {
        message = "BHAI YE KUCH ZYADA HI SUS HAI 🚨💀";
    } else if (sus >= 70) {
        message = "Chat investigation shuru karo! 🔎😂";
    } else if (sus >= 40) {
        message = "Hmmmm... kuch toh gadbad hai. 👀";
    } else {
        message = "Surprisingly innocent... chat disappointed. 😂";
    }

    res.send(
        `🚨 ${username} SUS LEVEL: ${sus}% → ${message}`
    );
});


// 😂 EXCUSE
app.get("/excuse", (req, res) => {
    const username = cleanUsername(req.query.user);

    const excuses = [
        `😂 ${username} lost because mouse ka mood kharab tha. 🖱️😭`,
        `💀 ${username} lost because opponent ke pieces emotionally stronger the.`,
        `😭 ${username} lost because chai time pe nahi mili. ☕`,
        `😂 ${username} lost because board 3 degrees left tilted tha.`,
        `💀 ${username} lost because king ne cooperate karne se mana kar diya.`,
        `😭 ${username} lost because internet ne personally dhokha diya.`,
        `😂 ${username} lost because opponent ne aaj zyada soch liya.`,
        `💀 ${username} lost because Mercury galat opening mein tha. 🔮`,
        `😭 ${username} lost because keyboard ne galat move press kar diya.`,
        `😂 ${username} lost because aaj universe opponent ke side tha. 🌍💀`
    ];

    res.send(randomItem(excuses));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});