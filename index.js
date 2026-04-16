require("dotenv").config();
const fs = require("fs");
const { google } = require("googleapis");
const { Client, GatewayIntentBits } = require("discord.js");

const client = new Client({
  intents: [GatewayIntentBits.Guilds]
});

const youtube = google.youtube({
  version: "v3",
  auth: process.env.YOUTUBE_API_KEY
});

// PUT YOUR 2 YOUTUBE CHANNEL IDS HERE
const CHANNELS = [
  { name: "Pitxu", id: "UCKKTLAnm4hyUINsWSK3aKtQ" },
  { name: "Jordan", id: "UCWdXgGRke7YkHx-U73ceZig" }
];

const DATA_FILE = "./data.json";

function loadData() {
  try {
    if (!fs.existsSync(DATA_FILE)) return {};
    return JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));
  } catch (error) {
    console.log("Error reading data.json:", error.message);
    return {};
  }
}

function saveData(data) {
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.log("Error saving data.json:", error.message);
  }
}

async function getUploadsPlaylist(channelId) {
  const res = await youtube.channels.list({
    part: "contentDetails",
    id: channelId
  });

  if (!res.data.items || !res.data.items.length) return null;
  return res.data.items[0].contentDetails.relatedPlaylists.uploads;
}

async function getLatestVideo(playlistId) {
  const res = await youtube.playlistItems.list({
    part: "snippet,contentDetails",
    playlistId,
    maxResults: 1
  });

  if (!res.data.items || !res.data.items.length) return null;

  const item = res.data.items[0];
  return {
    id: item.contentDetails.videoId,
    title: item.snippet.title
  };
}

async function checkLive(channelId) {
  const res = await youtube.search.list({
    part: "snippet",
    channelId: channelId,
    eventType: "live",
    type: "video",
    maxResults: 1
  });

  if (!res.data.items || !res.data.items.length) return null;
  return res.data.items[0];
}

async function checkAll() {
  try {
    const uploadChannel = await client.channels.fetch(process.env.UPLOAD_CHANNEL_ID);
    const liveChannel = await client.channels.fetch(process.env.LIVE_CHANNEL_ID);

    if (!uploadChannel) {
      console.log("Upload channel not found.");
      return;
    }

    if (!liveChannel) {
      console.log("Live channel not found.");
      return;
    }

    const data = loadData();

    for (const c of CHANNELS) {
      try {
        // Check uploads
        const playlist = await getUploadsPlaylist(c.id);
        if (!playlist) {
          console.log(`No uploads playlist found for ${c.name}`);
          continue;
        }

        const latest = await getLatestVideo(playlist);
        if (!latest) {
          console.log(`No latest video found for ${c.name}`);
          continue;
        }

        if (data[c.id] !== latest.id) {
          if (data[c.id]) {
            await uploadChannel.send(
              `<@&${process.env.UPLOAD_ROLE_ID}> ${c.name.toUpperCase()} JUST UPLOADED! https://youtu.be/${latest.id}`
            );
          }
          data[c.id] = latest.id;
        }

        // Check livestreams
        const live = await checkLive(c.id);

if (live && data[`${c.id}_live`] !== live.id.videoId) {
  await liveChannel.send({
    content: `<@&${process.env.LIVE_ROLE_ID}> ${c.name.toUpperCase()} IS LIVE! https://youtu.be/${live.id.videoId}`,
    allowedMentions: { roles: [process.env.LIVE_ROLE_ID] }
  });

  data[`${c.id}_live`] = live.id.videoId;
}
  data[`${c.id}_live`] = live.id.videoId;
}
          );
          data[`${c.id}_live`] = live.id.videoId;
        }

        if (!live) {
          delete data[`${c.id}_live`];
        }
      } catch (err) {
        console.log(`Error checking ${c.name}:`, err.message);
      }
    }

    saveData(data);
  } catch (err) {
    console.log("Main check error:", err.message);
  }
}

client.once("ready", async () => {
  console.log(`Logged in as ${client.user.tag}`);
  await checkAll();
  setInterval(checkAll, 5 * 60 * 1000);
});

client.login(process.env.DISCORD_TOKEN);
