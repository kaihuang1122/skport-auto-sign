const profiles = [
  {
    SK_OAUTH_CRED_KEY: "", // your skport SK_OAUTH_CRED_KEY in cookie
    SK_TOKEN_CACHE_KEY: "", // your SK_TOKEN_CACHE_KEY in localStorage
    
    arknights: true,
    arknights_uid: "", // your Arknights character uid
    
    endfield: true,
    endfield_id: "", // your Endfield game id
    endfield_server: "2", // Asia=2 Americas/Europe=3
    
    language: "en", // english=en 日本語=ja 繁體中文=zh_Hant 简体中文=zh_Hans 한국어=ko Русский=ru_RU
    accountName: "YOUR NICKNAME"
  }
];

const telegram_notify = false
const myTelegramID = ""
const telegramBotToken = ""

/** The above is the config. Please refer to the instructions on https://github.com/canaria3406/skport-auto-sign for configuration. **/
/** The following is the script code. Please DO NOT modify. **/

const urlDict = {
  Endfield: 'https://zonai.skport.com/web/v1/game/endfield/attendance',
  Arknights: 'https://zonai.skport.com/api/v1/game/attendance',
};

const headerDict = {
  default: {
    'Accept': '*/*',
    'Accept-Encoding': 'gzip, deflate, br, zstd',
    'Content-Type': 'application/json',
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:147.0) Gecko/20100101 Firefox/147.0',
    'Referer': 'https://game.skport.com/',
    'platform': '3',
    'vName': '1.0.0',
    'Origin': 'https://game.skport.com',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-site',
    'Priority': 'u=0',
    'TE': 'trailers',
  },
}

function bytesToHex(bytes) {
  return Array.from(bytes).map(b => (b < 0 ? b + 256 : b).toString(16).padStart(2, '0')).join('');
}

function generateSign(path, method, headers, query, body, token) {
  let stringToSign = path + (method === "GET" ? (query || "") : (body || ""));
  if (headers.timestamp) stringToSign += headers.timestamp.toString();
  
  const headerObj = {};
  ["platform", "timestamp", "dId", "vName"].forEach(key => {
    if (headers[key]) headerObj[key] = headers[key];
    else if (key === "dId") headerObj[key] = "";
  });
  stringToSign += JSON.stringify(headerObj);
  
  const hmacHex = bytesToHex(Utilities.computeHmacSha256Signature(stringToSign, token));
  return bytesToHex(Utilities.computeDigest(Utilities.DigestAlgorithm.MD5, hmacHex, Utilities.Charset.UTF_8));
}

async function main() {
  const messages = profiles.map(autoSignFunction);
  const skportResp = `${messages.join('\n\n')}`;
  if (telegram_notify && telegramBotToken && myTelegramID) {
    postWebhook(skportResp);
  }
}

function autoSignFunction({
  SK_OAUTH_CRED_KEY,
  SK_TOKEN_CACHE_KEY,
  arknights = false,
  arknights_uid,
  endfield = false,
  endfield_id,
  endfield_server,
  language = "en",
  accountName
}) {
  const urlsnheaders = [];
  const timestamp = String(Math.floor(Date.now() / 1000));

  if (arknights) {
    urlsnheaders.push({
      gameName: "Arknights",
      url: urlDict.Arknights,
      path: "/api/v1/game/attendance",
      body: JSON.stringify({ uid: arknights_uid, gameId: "1" }),
      role: `1_${arknights_uid}_1`
    });
  }

  if (endfield) {
    urlsnheaders.push({
      gameName: "Endfield",
      url: urlDict.Endfield,
      path: "/web/v1/game/endfield/attendance",
      body: "",
      role: `3_${endfield_id}_${endfield_server}`
    });
  }

  let response = `Check-in completed for ${accountName}`;

  for (const req of urlsnheaders) {
    const headers = {
      ...headerDict.default,
      cred: SK_OAUTH_CRED_KEY,
      "sk-game-role": req.role,
      "sk-language": language,
      timestamp,
    };
    headers.sign = generateSign(req.path, 'POST', headers, '', req.body, SK_TOKEN_CACHE_KEY);

    const options = {
      method: 'POST',
      headers: headers,
      muteHttpExceptions: true
    };
    if (req.body) {
      options.payload = req.body;
    }

    const httpResponse = UrlFetchApp.fetch(req.url, options);
    const responseJson = JSON.parse(httpResponse.getContentText());

    if (responseJson.code === 10000) {
      response += `\n${req.gameName}: ⚠️ Token expired! \nPlease update SK_TOKEN_CACHE_KEY in your config.`;
    } else {
      response += `\n${req.gameName}: ${responseJson.message}`;
    }
  }

  return response;
}

function postWebhook(data) {
  let payload = JSON.stringify({
    'chat_id': myTelegramID,
    'text': data,
    'parse_mode': 'HTML'
  });

  const options = {
    method: 'POST',
    contentType: 'application/json',
    payload: payload,
    muteHttpExceptions: true
  };

  UrlFetchApp.fetch('https://api.telegram.org/bot' + telegramBotToken + '/sendMessage', options);
}
