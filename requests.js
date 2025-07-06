const response1 = await fetch("https://workflowy.com/push_and_poll?uti=3525750-1751699651933-mqkGPtdR", {
  "headers": {
    "accept": "application/json",
    "accept-language": "en-GB,en;q=0.7",
    "content-type": "application/x-www-form-urlencoded; charset=UTF-8",
    "priority": "u=1, i",
    "sec-ch-ua": "\"Not)A;Brand\";v=\"8\", \"Chromium\";v=\"138\", \"Brave\";v=\"138\"",
    "sec-ch-ua-mobile": "?0",
    "sec-ch-ua-platform": "\"Linux\"",
    "sec-fetch-dest": "empty",
    "sec-fetch-mode": "cors",
    "sec-fetch-site": "same-origin",
    "sec-gpc": "1",
    "wf-transient-id": "c9b75caf-8b70-4c7a-5522-5c951f8920a6",
    "x-requested-with": "XMLHttpRequest",
    "cookie": "sessionid=c55o9up61ns7u0nwfygrvaytt33vcqcv; __stripe_mid=64c8d51e-a1a7-4a3e-8ad2-31bd749d404c448d1b; sentry_user_id=3525750; sentry_user_email=medhansh2005@gmail.com; wire_theme_current=dark; amp_ac4aa1=QCGydkZYHC-c7Am9oxtK2B.MzUyNTc1MA==..1ivcmtmsp.1ivcmtoia.0.13.13; __stripe_sid=9b0e3a3c-2f3f-4bf6-8dbc-9c6e0b2595ddea774d; _bess=38b8086b1de9a373"
  },
  "body": "client_id=2025-07-05+07%3A13%3A29.026737&client_version=21&push_poll_id=mqkGPtdR&push_poll_data=%5B%7B%22most_recent_operation_transaction_id%22%3A%221178237147%22%2C%22operations%22%3A%5B%7B%22type%22%3A%22bulk_create%22%2C%22data%22%3A%7B%22parentid%22%3A%22f644c65b-51ec-45ad-b3d5-7cd3b318585b%22%2C%22starting_priority%23%3A12%2C%22project_trees%22%3A%22%5B%7B%5C%22nm%5C%22%3A%5C%22%5C%22%2C%5C%22metadata%5C%22%3A%7B%7D%2C%5C%22id%5C%22%3A%5C%22e8113c40-83db-af69-1ca6-9c60a92ac909%5C%22%2C%5C%22ct%5C%22%3A75698490%2C%5C%22cb%5C%22%3A3525750%7D%5D%22%2C%22isForSearch%22%3Afalse%7D%2C%22client_timestamp%22%3A75698490%2C%22undo_data%22%3A%7B%7D%7D%5D%7D%5D&crosscheck_user_id=3525750",
  "method": "POST"
});

console.log(response1);

/*
client_id=2025-07-05+07%3A13%3A29.026737&client_version=21&push_poll_id=mqkGPtdR&push_poll_data=%5B%7B%22most_recent_operation_transaction_id%22%3A%221178237147%22%2C%22operations%22%3A%5B%7B%22type%22%3A%22bulk_create%22%2C%22data%22%3A%7B%22parentid%22%3A%22f644c65b-51ec-45ad-b3d5-7cd3b318585b%22%2C%22starting_priority%23%3A12%2C%22project_trees%22%3A%22%5B%7B%5C%22nm%5C%22%3A%5C%22%5C%22%2C%5C%22metadata%5C%22%3A%7B%7D%2C%5C%22id%5C%22%3A%5C%22e8113c40-83db-af69-1ca6-9c60a92ac909%5C%22%2C%5C%22ct%5C%22%3A75698490%2C%5C%22cb%5C%22%3A3525750%7D%5D%22%2C%22isForSearch%22%3Afalse%7D%2C%22client_timestamp%22%3A75698490%2C%22undo_data%22%3A%7B%7D%7D%5D%7D%5D&crosscheck_user_id=3525750

client_id=2025-07-05 07:13:29.026737
client_version=21
push_poll_id=mqkGPtdR
push_poll_data=
[
  {
    "most_recent_operation_transaction_id": "1178237147",
    "operations": [
      {
        "type": "bulk_create",
        "data": {
          "parentid": "f644c65b-51ec-45ad-b3d5-7cd3b318585b",
          "starting_priority": 12,
          "project_trees": [
            {
              "nm": "",
              "metadata": {},
              "id": "e8113c40-83db-af69-1ca6-9c60a92ac909",
              "ct": 75698490,
              "cb": 3525750
            }
          ],
          "isForSearch": false
        },
        "client_timestamp": 75698490,
        "undo_data": {}
      }
    ]
  }
]
crosscheck_user_id=3525750

*/

import fs from "fs";

const CONFIG_PATH = './.wfconfig.json';
const config = JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));

const response2 = await fetch("https://workflowy.com/push_and_poll?uti=3525750-1751732205766-QlSp4JR0", {
  "headers": {
    "cookie": `sessionid: ${config.sessionid}`
  },
  "body": "client_id=2025-07-05+07%3A19%3A26.431305&client_version=21&push_poll_id=QlSp4JR0&push_poll_data=%5B%7B%22most_recent_operation_transaction_id%22%3A%221178250831%22%2C%22operations%22%3A%5B%7B%22type%22%3A%22bulk_create%22%2C%22data%22%3A%7B%22parentid%22%3A%22None%22%2C%22starting_priority%22%3A0%2C%22project_trees%22%3A%22%5B%7B%5C%22nm%5C%22%3A%5C%22%5C%22%2C%5C%22metadata%5C%22%3A%7B%7D%2C%5C%22id%5C%22%3A%5C%22b83100a9-f228-0003-0973-2ba9cd1197bd%5C%22%2C%5C%22ct%5C%22%3A75731043%2C%5C%22cb%5C%22%3A3525750%7D%5D%22%2C%22isForSearch%22%3Afalse%7D%2C%22client_timestamp%22%3A75731043%2C%22undo_data%22%3A%7B%7D%7D%5D%7D%5D&crosscheck_user_id=3525750",
  "method": "POST"
});

console.log(response2);

/*
client_id=2025-07-05 07:19:26.431305
client_version=21
push_poll_id=QlSp4JR0
push_poll_data=
[
  {
    "most_recent_operation_transaction_id": "1178250831",
    "operations": [
      {
        "type": "bulk_create",
        "data": {
          "parentid": "None",
          "starting_priority": 0,
          "project_trees": "
            [
              {
                "nm": "",
                "metadata": {},
                "id": "b83100a9-f228-0003-0973-2ba9cd1197bd",
                "ct": 75731043,
                "cb": 3525750
              }
            ]
          ",
          "isForSearch": false
        },
        "client_timestamp": 75731043,
        "undo_data": {}
      }
    ]
  }
]
crosscheck_user_id=3525750
*/