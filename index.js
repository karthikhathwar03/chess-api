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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});