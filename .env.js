const production = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "production",
};

const development = {
  ...process.env,
  NODE_ENV: process.env.NODE_ENV || "development",
  PORT: "3000",
  Meta_WA_accessToken:
    "EAAvx73GwQFoBABZCaZCKswZBTAZBr8vUEL3JCC2902uyBXfLj6Ytgf5HMVP6lhEBqHiUekLNdoyZCf2Uid0awZAcV8ZBxoN3ZAEaz9fwzDxyQJQIZBMYS3ZCXzbHKacKHvm5YEe9OgTzT1szPtUZBS7b3hGwXzG2vQFGkRR1C8kTdhgG5crbwtxJMf1GUZBWqRVPskRamfsgPkP2PLDVD3yup289KzAesFrYZAd4ZD",
  Meta_WA_SenderPhoneNumberId: "107565078729470",
  Meta_WA_wabaId: "109650065185281",
  Meta_WA_VerifyToken: "YouCanSetYourOwnToken",
  PAYSTACK_SECRET_KEY: "sk_test_935eae617833bd4bef05d6b33d641b713741fadf",
};

const fallback = {
  ...process.env,
  NODE_ENV: undefined,
};

module.exports = (environment) => {
  console.log(`Execution environment selected is: "${environment}"`);
  if (environment === "production") {
    return production;
  } else if (environment === "development") {
    return development;
  } else {
    return fallback;
  }
};
