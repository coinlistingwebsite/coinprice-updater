require("dotenv").config();
const { initializeApp } = require("firebase/app");
const {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  collection,
} = require("firebase/firestore");
const axios = require("axios");

const firebaseConfig = {
  apiKey: process.env.FIREBASE_API_KEY,
  authDomain: process.env.FB_AUTH_DOMAIN,
  projectId: process.env.FB_PROJECT_ID,
  storageBucket: process.env.FB_STORAGE,
  messagingSenderId: process.env.FB_SENDER_ID,
  appId: process.env.FB_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const fetchDexScreenerData = async (chainId, tokenAddress) => {
  try {
    const response = await axios.get(
      `https://api.dexscreener.com/token-pairs/v1/${chainId}/${tokenAddress}`
    );
    return response.data;
  } catch (error) {
    console.error(
      `Error fetching DexScreener data for ${tokenAddress}:`,
      error.message
    );
    return null;
  }
};

const updatePriceData = async (tokenAddress, marketData) => {
  try {
    const priceDocRef = doc(db, "prices", tokenAddress);
    const docSnap = await getDoc(priceDocRef);

    if (docSnap.exists()) {
      await setDoc(priceDocRef, { market_data: marketData }, { merge: true });
      console.log(`Updated market data for ${tokenAddress}`);
    } else {
      await setDoc(priceDocRef, {
        contract_address: tokenAddress,
        market_data: marketData,
      });
      console.log(`Created new price document for ${tokenAddress}`);
    }
  } catch (error) {
    console.error(`Error updating price data for ${tokenAddress}:`, error);
  }
};

const updateMarketData = async () => {
  try {
    console.log(
      `Starting market data update at ${new Date().toLocaleString()}`
    );

    // Fetch tokens data
    const tokensRef = doc(db, "tokens", "GabvrvXUnIqV5D5e1jqV");
    const tokensSnap = await getDoc(tokensRef);

    if (!tokensSnap.exists()) {
      console.error("Tokens document not found");
      return;
    }

    const tokens = tokensSnap.data().tokens;

    // Process each token
    for (const token of tokens) {
      const { contract_address, chain } = token;

      if (!contract_address || !chain) {
        console.log(`Skipping token due to missing data:`, token.project_name);
        continue;
      }

      console.log(`Processing ${token.project_name}...`);

      // Get market data from DexScreener
      const marketData = await fetchDexScreenerData(chain, contract_address);

      if (marketData) {
        await updatePriceData(contract_address, marketData);
      }

      // Add delay to respect rate limit (300 requests per minute = 1 request per 200ms)
      await new Promise((resolve) => setTimeout(resolve, 200));
    }

    console.log(
      `Market data update completed at ${new Date().toLocaleString()}`
    );
    process.exit(0); // Exit successfully after completion
  } catch (error) {
    console.error("Error in update process:", error);
    process.exit(1); // Exit with error code
  }
};

// Run the update once
console.log("Starting one-time market data update...");
updateMarketData().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});

// Handle process termination gracefully
process.on("SIGINT", () => {
  console.log("Received SIGINT. Shutting down...");
  process.exit(0);
});

process.on("SIGTERM", () => {
  console.log("Received SIGTERM. Shutting down...");
  process.exit(0);
});
