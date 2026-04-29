const fs = require('fs');
const https = require('https');

const supabaseUrl = 'https://ngmgxqahznycnzuaraez.supabase.co';
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5nbWd4cWFoem55Y256dWFyYWV6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcxMDkwNDUsImV4cCI6MjA5MjY4NTA0NX0.YgdGYHa0bgGqKCFQ7-NaNLH7PTodBTNMk2JGRN07J4Y';

async function restoreAuctions() {
  console.log("Reading backup.json...");
  let rawData;
  try {
    rawData = fs.readFileSync('backup.json', 'utf8');
  } catch (err) {
    console.error("Could not read backup.json", err);
    return;
  }

  const data = JSON.parse(rawData);
  const auctionSessions = data.auctionSessions || [];

  if (!Array.isArray(auctionSessions) || auctionSessions.length === 0) {
    console.error("No auction sessions found in backup.json");
    return;
  }

  console.log(`Found ${auctionSessions.length} auction sessions. Formatting...`);

  const formattedSessions = auctionSessions.map(session => ({
    id: session.id,
    name: session.name || session.id,
    date: session.date || new Date().toISOString().split('T')[0],
    columns: session.columns || [],
    members: session.members || [],
    cells: session.cells || {}
  }));

  console.log("Uploading to Supabase...");

  const response = await fetch(`${supabaseUrl}/rest/v1/auction_sessions`, {
    method: 'POST',
    headers: {
      'apikey': supabaseAnonKey,
      'Authorization': `Bearer ${supabaseAnonKey}`,
      'Content-Type': 'application/json',
      'Prefer': 'resolution=merge-duplicates'
    },
    body: JSON.stringify(formattedSessions)
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error("Upload failed:", response.status, errText);
  } else {
    console.log("Successfully restored all auction sessions!");
  }
}

restoreAuctions();
