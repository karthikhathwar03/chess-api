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

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});