const express = require("express");

const app = express();
const PORT = process.env.PORT || 3000;

const DEFAULT_USER = "Blunderexpert_yt";

function cleanUsername(username) {
    if (
        !username ||
        username.trim() === "" ||
        username.toLowerCase() === "null" ||
        username.toLowerCase() === "undefined"
    ) {
        return DEFAULT_USER;
    }
    return username.trim();
}

app.get("/brilliant", async (req, res) => {
    const username = cleanUsername(req.query.user);

    try {
        const response = await fetch(
            `https://api.chess.com/pub/player/${username}/stats`
        );

        if (!response.ok) {
            return res.send(`❌ Player '${username}' not found.`);
        }

        const data = await response.json();

        // Chess.com stores insights differently for different accounts.
        // Check several possible locations.
        const brilliant =
            data.fide?.brilliant ??
            data.chess_rapid?.brilliant ??
            data.chess_blitz?.brilliant ??
            data.chess_bullet?.brilliant ??
            data.brilliant ??
            0;

        res.send(`♛ ${username} has ${brilliant} Brilliant moves!`);
    } catch (err) {
        console.error(err);
        res.send("Error fetching data.");
    }
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});