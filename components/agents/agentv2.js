const puppeteer = require("puppeteer");
const axios = require("axios");

async function performScraping(res) {
  // Run the analysis and test function
  // Example curl command

  await fetchData();
  //await analyzeAndCreateApiCall();
  /*  .then(() => console.log('Analysis Complete'))
  .catch((error) => console.error('Error:', error)); */

  /* console.log("Starting Scraping...");

  console.log("Step 0: Starting script...");
  const browser = await puppeteer.launch({ headless: true }); // Use headless: true for a headless browser
  const page = await browser.newPage();

  // Log all XHR responses with JSON content type, skipping invalid JSON
  page.on("response", async (response) => {
    const request = response.request();
    if (
      request.resourceType() === "xhr" &&
      (response.headers()["content-type"]?.includes("application/json") ||
        response.headers()["content-type"]?.includes("text"))
    ) {
      const url = request.url();
      try {
        const jsonData = await response.json();
        console.log(`XHR Request to: ${url}`);
        console.log("JSON Response:", JSON.stringify(jsonData, null, 2));

        // Review headers from the original XHR request
        const headers = request.headers();
        console.log("Request Headers:", headers);

        // Create an API call based on the XHR request and headers
        await createApiCall(url, headers);
      } catch (error) {
        console.error(`Failed to parse JSON from ${url}, skipping...`);
      }
    }
  });

  // Step 1: Goto the website
  console.log("Step 1: Navigating to website...");
  await page.goto("https://bidplus.gem.gov.in/all-bids", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Step 2: Set the viewport
  console.log("Step 2: Setting viewport...");
  await page.setViewport({ width: 1920, height: 992 });

  // Step 3: Click on the search bar
  console.log("Step 3: Clicking on search bar...");
  await page.waitForSelector("#searchBid", { visible: true }); // Wait until element is visible
  await page.evaluate(() =>
    document.querySelector("#searchBid").scrollIntoView()
  ); // Scroll to the element
  await page.click("#searchBid");

  // Step 4: Type "cloud" in the search bar
  console.log("Step 4: Typing 'cloud'...");
  await page.type(".container #searchBid", "cloud");

  // Step 5: Click on the search button
  console.log("Step 5: Clicking on the search button...");
  await page.waitForSelector(".row #searchBidRA");
  await page.evaluate(() =>
    document.querySelector(".row #searchBidRA").scrollIntoView()
  ); // Scroll to the element
  await page.click(".row #searchBidRA");

  // Step 6: Click on the second bid card
  console.log("Step 6: Clicking on second bid card...");
  await page.waitForSelector(
    "#bidCard > .card:nth-child(2) > .block_header > .bid_no > .bid_no_hover"
  );
  await page.evaluate(() =>
    document
      .querySelector(
        "#bidCard > .card:nth-child(2) > .block_header > .bid_no > .bid_no_hover"
      )
      .scrollIntoView()
  );
  await page.click(
    "#bidCard > .card:nth-child(2) > .block_header > .bid_no > .bid_no_hover"
  );

  console.log("Step 7: Collecting logs...");
  // Wait for a few seconds to capture additional XHR requests
  await new Promise((resolve) => setTimeout(resolve, 5000));
  console.log("Step 8: Collecting logs...");
  // Close the browser
  await browser.close();
  console.log("Step 9: Browser closed..."); */

  res.end();
  return "";
}

// Function to create API call based on retrieved XHR request headers and URL
async function createApiCall(url, headers) {
  try {
    // Filter out unnecessary headers and prepare the ones that are required for API call
    const filteredHeaders = {
      "Content-Type": headers["content-type"],
      "User-Agent": headers["user-agent"],
      Authorization: headers["authorization"], // If there's an authorization token
      Cookie: headers["cookie"], // Pass any necessary cookies
      // You can add more headers depending on what's available in the request headers
    };

    console.log("Making API call with headers:", filteredHeaders);

    // Make an API request to the same URL using axios
    const response = await axios.get(url, { headers: filteredHeaders });
    console.log(
      `API Response from ${url}:`,
      JSON.stringify(response.data, null, 2)
    );
  } catch (error) {
    console.error(`Failed to make API call to ${url}:`, error.message);
  }
}

async function analyzeAndCreateApiCall() {
  const browser = await puppeteer.launch({ headless: false });
  const page = await browser.newPage();

  // Step 1: Goto the website
  await page.goto("https://bidplus.gem.gov.in/all-bids", {
    waitUntil: "domcontentloaded",
    timeout: 60000,
  });

  // Step 2: Capture XHR responses to analyze headers
  page.on("response", async (response) => {
    const request = response.request();
    if (
      request.resourceType() === "xhr" &&
      response.headers()["content-type"]?.includes("text")
    ) {
      const url = request.url();
      try {
        const jsonData = await response.json();
        console.log(`XHR Request to: ${url}`);
        console.log("JSON Response:", JSON.stringify(jsonData, null, 2));

        // Review headers from the original XHR request
        const headers = request.headers();
        console.log("Request Headers:", headers);

        // Test multiple header combinations for the API call
        await testHeaderCombinations(url, headers);

        // Create an API call based on the XHR request and headers
        await createApiCall(url, headers);
      } catch (error) {
        console.error(`Failed to parse JSON from ${url}, skipping...`);
      }
    }
  });

  // Interact with the page to trigger XHR requests
  await page.waitForSelector("#searchBid", { visible: true });
  await page.type("#searchBid", "cloud");
  await page.click("#searchBidRA");

  await new Promise((resolve) => setTimeout(resolve, 5000)); // Wait for XHR to complete
  await browser.close();
}

// Function to test multiple header combinations and analyze results
async function testHeaderCombinations(url, headers) {
  const essentialHeaders = [
    "User-Agent",
    "Accept",
    "Authorization",
    "Cookie",
    "Content-Type",
  ];
  let validCombinationFound = false;

  // Recursive function to try different combinations of headers
  async function tryHeaderCombination(selectedHeaders) {
    try {
      const filteredHeaders = {};
      for (let key of selectedHeaders) {
        if (headers[key.toLowerCase()]) {
          filteredHeaders[key] = headers[key.toLowerCase()];
        }
      }

      console.log(`Testing with headers: ${JSON.stringify(filteredHeaders)}`);
      const response = await axios.get(url, { headers: filteredHeaders });
      console.log(`Success! Data:`, response.data);
      validCombinationFound = true;
      return true; // Exit early if we succeed
    } catch (error) {
      console.error(
        `403 or error with headers: ${selectedHeaders}. Error: ${error.response?.status}`
      );
      return false;
    }
  }

  // Try all combinations of headers
  for (let i = 1; i <= essentialHeaders.length; i++) {
    const combinations = getCombinations(essentialHeaders, i);
    for (const combination of combinations) {
      const success = await tryHeaderCombination(combination);
      if (success) {
        return; // Stop trying once a valid combination is found
      }
    }
  }

  if (!validCombinationFound) {
    console.error("No valid header combination found.");
  }
}

// Function to generate all combinations of header keys
function getCombinations(arr, k) {
  const result = [];
  const combine = (prefix, start) => {
    if (prefix.length === k) {
      result.push(prefix);
      return;
    }
    for (let i = start; i < arr.length; i++) {
      combine(prefix.concat(arr[i]), i + 1);
    }
  };
  combine([], 0);
  return result;
}

async function fetchData() {
  const url = "https://bidplus.gem.gov.in/all-bids-data";

  const headers = {
    Accept: "application/json, text/javascript, */*; q=0.01",
    "Accept-Language":
      "en-US,en-GB;q=0.9,en;q=0.8,hi;q=0.7,zh-TW;q=0.6,zh;q=0.5",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
    Cookie:
      "_gid=GA1.3.1205317853.1725442645; ci_session=e201636f06f1d4e0b3da93ec2c97cb3dcfc58a9c; GEMDCPROD=NODE2; _ga=GA1.3.1951130283.1721189997; csrf_gem_cookie=2abe2e74fd8d5169cc1946780cd033e6; TS01fd1721=015c77a21c8b28fe3fba4fa715174f9896d23675ffffb11b8c0056f1cc42152771b3607605bba8f6b72af70b05a98a4f55f355f77a2c5c8e8cdfa17d29bb8a07097db1ba9e43041d0182ce651961b6994f5ef29164c7e7d8e56163231619247488b269b2cd; _gat=1; _ga_MMQ7TYBESB=GS1.3.1725524352.6.1.1725524356.56.0.0; TS01024d38=015c77a21c69f2d922fdd732f0013b46f35820d22f9176baa34d44d62f95189e5a80907cd8b16fef3504a1010eb38e6ffc1e8537d2cae18f844f625670650ca0975417c116",
    Origin: "https://bidplus.gem.gov.in",
    Pragma: "no-cache",
    Referer: "https://bidplus.gem.gov.in/all-bids",
    "Sec-Fetch-Dest": "empty",
    "Sec-Fetch-Mode": "cors",
    "Sec-Fetch-Site": "same-origin",
    "User-Agent":
      "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "X-Requested-With": "XMLHttpRequest",
    "sec-ch-ua":
      '"Chromium";v="128", "Not;A=Brand";v="24", "Google Chrome";v="128"',
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": '"macOS"',
  };

  const payload = {
    payload: JSON.stringify({
      param: { searchBid: "cloud", searchType: "fullText" },
      filter: {
        bidStatusType: "ongoing_bids",
        byType: "all",
        highBidValue: "",
        byEndDate: { from: "", to: "" },
        sort: "Bid-End-Date-Oldest",
      },
    }),
    csrf_bd_gem_nk: "2abe2e74fd8d5169cc1946780cd033e6",
  };

  const formEncodedPayload = new URLSearchParams(payload).toString();

  try {
    const response = await axios.post(url, formEncodedPayload, { headers });
    console.log("Data fetched successfully:", response.data);
  } catch (error) {
    console.error(
      "Error fetching data:",
      error.response?.status,
      error.response?.data
    );
  }
}

/**
 * Function to parse curl command and construct the API request using axios
 * @param {string} curlCommand - The complete curl command string
 */
async function fetchDataFromCurl(curlCommand) {
  try {
    const parsedCurl = parseCurl(curlCommand);
    const { url, headers, data } = parsedCurl;

    // Make an API request using axios
    const response = await axios.post(url, data, { headers });
    console.log("Data fetched successfully:", response.data);
  } catch (error) {
    console.error(
      "Error fetching data:",
      error.response?.status,
      error.response?.data
    );
  }
}

module.exports = { performScraping };
