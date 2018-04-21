// LINEの認証を突破するために必要なお作法
// botのChannel基本設定の画面で発行した鬼のように長い文字列を""の中にセット
var secret_token = "******************"
var secret = "Bearer " + secret_token;
var docid = "***************";

function doPost(e) {
  try {
    handleMessage(e);
  } catch(error) {
    var postData = {
      "replyToken": token,
      "messages": [{
        "type": "text",
        "text": error.message
      }]
    };
    fetchData(postData);
  }
}

function handleMessage(e) {
  // LINEから送信されたデータを取得（テキストメッセージそのものではない。）
  var json = e.postData.getDataAsString();
  var json_content = JSON.parse(e.postData.contents);

  // LINEから送信されてきたデータから、リプライトークン（返信するために必要）を取得
  var token = JSON.parse(json).events[0].replyToken;

  //ユーザーIDの取得
  var userid = JSON.parse(json).events[0].source.userId;
  var username = getUsername(userid);

  //イベントタイプの取得
  var type = JSON.parse(json).events[0].type;

  //キャッシュの取得
  var cache = CacheService.getScriptCache();
  var eventseq = cache.get("eventseq");

  //キャッシュのクリアの動作
  if (type === "message") {
    if (JSON.parse(json).events[0].message.text === "キャンセル") {
      cache.remove("eventseq");
      var postData = {
      "replyToken": token,
      "messages": [{
        "type": "text",
        "text": "キャッシュをクリアしました"
      }]
    };
    fetchData(postData);
    }
  }

  //イベント作成・キャッシュで分岐
  if (eventseq === '1' || eventseq === '2' || eventseq === '3') {
    if (eventseq === '1' && type === "message") {
      cache.put("eventseq", 2);
    } else if (eventseq === '2' && type === "postback") {
      cache.put("eventseq", 3 );
    } else if (eventseq === '3'&& type === "postback") {
      if (JSON.parse(json).events[0].postback.data === "confirm") {
        //キャッシュからイベントをFusionTbalesに書き込み
        writeEvent(cache, userid, token);
        cache.remove("eventseq");
        var postData = {
          "replyToken": token,
          "messages": [{
            "type": "text",
            "text": "作成しました"
          }]
        };
        fetchData(postData);
      } else if (JSON.parse(json).events[0].postback.data === "cancel") {
        var postData = {
          "replyToken": token,
          "messages": [{
            "type": "text",
            "text": "キャンセルしました"
          }]
        };
        cache.remove("eventseq");
        fetchData(postData);
      }
    }
    createEvent(eventseq, cache, token, json);

  } else if (type==='postback' ) {
    var data = JSON.parse(json).events[0].postback.data;
    if (data.match("action=")) {
      //予定の確認、作成、削除へ
      post_back(json, token, username, userid, cache);
    } else if (data.match("delete=confirm=")) {
      //予定の削除へ
      DeleteFromTable(userid, token, data, cache);
    } else if (data.match("add_digit")) {
      deleteEvent(userid, token, cache, data);
    }
  } else {
    // 送信されてきたテキストを取り出し
    if (type === 'message') {
      var text = JSON.parse(json).events[0].message.text;
      //ユーザーくんがトリガー
      if (text==='イベマネさん') {
        userChoose(username, token);
      }
    }
  }
}

function userChoose(username, token) {
  var postData = {
    "replyToken": token,
    "messages": [{
      "type": "template",
      "altText": "イベマネです",
      "template": {
        "type": "buttons",
        "thumbnailImageUrl": "https://www.pakutaso.com/shared/img/thumb/SAYA160312370I9A3675_TP_V.jpg",
        "title": "予定を調整させていただきます",
        "text": username + "さんは何をしたいですか？？",
        "actions": [{
            "type": "postback",
            "label": "予定の確認",
            "data": "action=lookup"
            //"text": "押しました"
         },
         {
           "type": "postback",
           "label": "予定の作成",
           "data": "action=create"
         },
         {
           "type": "postback",
           "label": "予定の削除",
           "data": "action=delete"
         },
         {
           "type": "postback",
           "label": "メンバー内の予定の調整",
           "data": "action=organize"
         }
       ]
     }
   }]
 };
 fetchData(postData);
}

function post_back(json, token, username, userid, cache) {
  //ユーザーがどのアクションをしたのか判別する
  var data = JSON.parse(json).events[0].postback.data;

  if (data === 'action=lookup') {

    var messages = getEvent(userid);

  } else if (data === 'action=create') {

    cache.put("eventseq", 1);
    var messages　 = [{
      "type": "text",
      "text": "イベントの名前を入力してください"
    }]

  } else if (data === 'action=delete') {

    deleteEvent(userid, token, cache, data);

  } else if (data === 'action=organize') {
    var messages　 = [{
      "type": "text",
      "text": "この機能はまだ実装されてないよ"
    }]
  }
  var postData = {
    "replyToken": token,
    "messages": messages
  };
  fetchData(postData);
}

function getEvent(userid) {
  var username = getUsername(userid);
  var message = username + 'さんの予定はこちらです';
  var user_id = userid;
  var sql_filter = "select * from "+ docid + " where Userid = '"+ user_id + "';";
  var res_filter = FusionTables.Query.sql(sql_filter);
  var result = '';
  if (typeof res_filter.rows === "undefined" ) {
    var messages = [{
      "type": "text",
      "text": "まだイベントが作成されていません"
    }]
  } else {
  for (var i = 0; i < res_filter.rows.length; i++){
    var starttime = res_filter.rows[i][2].split("T")[1];
    var endtime = res_filter.rows[i][3].split("T")[1];
    var startdate = res_filter.rows[i][2].split("T")[0].slice(5);
    var enddate = res_filter.rows[i][3].split("T")[0].slice(5);
    if (startdate !== enddate) {
      result += "\n" + res_filter.rows[i][1] + " " + startdate + " " + starttime + "〜" + enddate + ":" + endtime ;
    } else if (startdate === enddate) {
      result += "\n" + res_filter.rows[i][1] + " " + startdate + " " + starttime + "〜" + endtime ;
    }
  }
  var messages = [{
    "type": "text",
    "text": message + result
  }]
  }
  return messages;
}

function createEvent(eventseq, cache, token, json) {
      switch(eventseq) {
        case "1":
          var eventname = JSON.parse(json).events[0].message.text;
          var text = "開始時間を入力してください";
          var postData = {
            "replyToken": token,
            "messages": [{
              "type": "template",
              "altText": "開始時間",
              "template": {
                "type": "buttons",
                "title": "予定を作成させていただきます",
                "text": "開始時間を選んでください",
                "actions": [
                  {
                    "type":"datetimepicker",
                    "label":"開始時刻を選んでください",
                    "data":"endtime",
                    "mode":"datetime",
                    "max":"2020-03-31t23:59",
                    "min":"2018-04-01t00:00"
                  }
                ]
              }
           }]
          };
          cache.put("eventname", eventname);
          fetchData(postData);
          break;
        case "2":
          //開始時間の処理
          var starttime = JSON.parse(json).events[0].postback.params['datetime'];
          var text = "終了時間を入力してください";
          var postData = {
            "replyToken": token,
            "messages": [
              //{
              //  "type": "text",
              //  "text": starttime + "開始ですね？"
              //},
              {
              "type": "template",
              "altText": "終了時間",
              "template": {
                "type": "buttons",
                "title": "予定を作成させていただきます",
                "text": "次に終了時刻を選んでください",
                "actions": [
                  {
                    "type":"datetimepicker",
                    "label":"終了時刻を選んでください",
                    "data":"endtime",
                    "mode":"datetime",
                    "max":"2020-03-31t23:59",
                    "min":"2018-04-01t00:00"
                  }
                ]
              }
           }]
          };
          cache.put("starttime", starttime);
          fetchData(postData);
          break;
        case "3":
          var eventname = cache.get("eventname");
          var starttime = cache.get("starttime").split("T")[1];
          var endtime = JSON.parse(json).events[0].postback.params['datetime'].split("T")[1];
          var startdate = cache.get("starttime").split("T")[0].slice(5);
          var enddate = JSON.parse(json).events[0].postback.params['datetime'].split("T")[0].slice(5);
          cache.put("endtime", JSON.parse(json).events[0].postback.params['datetime']);
          var postData = {
            "replyToken": token,
            "messages": [
              {
              "type": "template",
              //"thumbnailImageUrl": "https://www.pakutaso.com/shared/img/thumb/SAYA072160011_TP_V.jpg",
              "altText": "確認/キャンセル",
              "template": {
                "type": "confirm",
                "text": eventname + " " + startdate + " " +  starttime + "~" + enddate + " " + endtime + "で確定させますか？",
                "actions": [
                  {
                    "type": "postback",
                    "label": "確定",
                    "data": "confirm",
                    "text": "確定"
                  },
                  {
                    "type": "postback",
                    "label": "キャンセル",
                    "data": "cancel",
                    "text": "キャンセル"
                  }
                ]
              }
            }]
          };
          fetchData(postData);
          break;
      }
}

function deleteEvent(userid, token, cache, data) {
  //どのイベントを削除しますか
  var username = getUsername(userid);
  var sql_filter = "select * from "+ docid + " where Userid = '"+ userid + "';";
  var sql_filter_getid = "select ROWID from "+ docid + " where Userid = '"+ userid + "';";
  var res_filter = FusionTables.Query.sql(sql_filter);
  var res_filter_getid = FusionTables.Query.sql(sql_filter_getid);
  var column = [];
  if (data.match("add_digit")){
    cache.put("event_digit", Number(cache.get("event_digit")) + 1);
  } else {
    cache.put("event_digit", 1);
  }
  var digit = Number(cache.get("event_digit"));

  if (typeof res_filter.rows === "undefined") {
    var postData = {
      "replyToken": token,
      "messages": [{
        "type": "text",
        "text": "まだイベントが作成されていません"
      }]
    };
    fetchData(postData);
  }

  if (res_filter.rows.length - (digit-1)*9 <= 10) {
    for (var i = (digit-1)*9; i < res_filter.rows.length; i++){
      var rowid = res_filter_getid.rows[i]
      var eventname = res_filter.rows[i][1];
      var starttime = res_filter.rows[i][2].split("T")[1];
      var endtime = res_filter.rows[i][3].split("T")[1];
      var startdate = res_filter.rows[i][2].split("T")[0].slice(5);
      var enddate = res_filter.rows[i][3].split("T")[0].slice(5);
      column.push({
        "title": eventname,
        "text": startdate + " " + starttime + "〜" + enddate + " " + endtime,
        "actions": [{
          "type": "postback",
          "label": "削除する",
          "data": "delete=confirm=" + rowid
        }]
      });
    }
  } else {
    for (var i = (digit-1)*10; i < (digit-1)*10+9; i++){
      var rowid = res_filter_getid.rows[i]
      var eventname = res_filter.rows[i][1];
      var starttime = res_filter.rows[i][2].split("T")[1];
      var endtime = res_filter.rows[i][3].split("T")[1];
      var startdate = res_filter.rows[i][2].split("T")[0].slice(5);
      var enddate = res_filter.rows[i][3].split("T")[0].slice(5);
      column.push({
        "title": eventname,
        "text": startdate + " " + starttime + "〜" + enddate + " " + endtime,
        "actions": [{
          "type": "postback",
          "label": "削除する",
          "data": "delete=confirm=" + rowid
        }]
      });
    }
    column.push({
        "title": "全",
        "text": "まだまだあるよ",
        "actions": [{
          "type": "postback",
          "label": "さらにイベントを表示",
          "data": "delete=add_digit"
        }]
    });
  }
  var message = {
    "type": "text",
    "text": "全" + res_filter.rows.length + "件のイベントがあります。どの予定を削除しますか？"
  }
  var postData = {
    "replyToken": token,
    "messages": [
      message,
      {
      "type": "template",
      "altText": "予定削除",
      "template": {
        "type": "carousel",
        "columns": column
      }
    }]
  }
  fetchData(postData);
}

function writeEvent(cache, userid, token) {
  var eventname = cache.get("eventname");
  var starttime = cache.get("starttime");
  var endtime = cache.get("endtime");
  var sql_insert = "insert into " + docid + " (Userid, Eventname, Starttime, Endtime) values ('" + userid + "','" + eventname + "','" + starttime + "','" + endtime + "');";
  var res_insert = FusionTables.Query.sql(sql_insert);
}

function DeleteFromTable(userid, token, data, cache) {
  var rowid = data.split("=")[2]
  var sql_delete = "DELETE FROM " + docid + "　where ROWID = " + rowid + ";";
  var res_delete = FusionTables.Query.sql(sql_delete);
  var postData = {
      "replyToken": token,
      "messages": [{
        "type": "text",
        "text": "削除しました"
      }]
  };
  cache.remove("event_digit")
  fetchData(postData);
}

function fetchData(postData) {
  var options = {
    "method": "post",
    "headers": {
      "Content-Type": "application/json",
      "Authorization": secret
    },
    "payload": JSON.stringify(postData)
  };
  UrlFetchApp.fetch("https://api.line.me/v2/bot/message/reply", options);
  return ContentService.createTextOutput(JSON.stringify({"content": "post ok"})).setMimeType(ContentService.MimeType.JSON);
}

function getUsername(userid) {
  var url = 'https://api.line.me/v2/bot/profile/' + userid;
  var response = UrlFetchApp.fetch(url, {
    'headers': {
      'Authorization':secret
    }
  });
  return JSON.parse(response.getContentText()).displayName;
}
