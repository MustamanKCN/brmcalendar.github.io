// ตั้งค่าตัวแปร
var ss = SpreadsheetApp.getActiveSpreadsheet()
var setting = ss.getSheetByName('Setting').getDataRange().getDisplayValues()
var taskSheet = ss.getSheetByName('Tasks');
var userInfo

// ฟังก์ชันสำหรับดึงข้อมูลงาน/กิจกรรม
function getTasks() {
  return taskSheet.getDataRange().getDisplayValues();
}

// ฟังก์ชันสำหรับดึงข้อมูลงาน/กิจกรรม
function getAllTasks() {
  return taskSheet.getDataRange().getDisplayValues().slice(1);
}

// ตรวจสอบผู้ใช้งานปัจจุบัน
function getCurrentUserEmail() {
  return Session.getActiveUser().getEmail();
}

// ตรวจสอบสิทธิ์ผู้ใช้
function checkUserRole() {
  var userEmail = getCurrentUserEmail();
  var teacherEmail //= "dun4kuruchon@gmail.com";  // อีเมลครูที่มีสิทธิ์แก้ไข
  teacherEmail = setting.slice(7).map(r => r[1])
  var mailIndex = teacherEmail.indexOf(userEmail)
  if (mailIndex < 0) {
    return {type: "other"};
  } else if (mailIndex >= 0 && setting[mailIndex+7][2] === "ครู") {
    return {type: "teacher",name:setting[mailIndex+7][3]};
  } else if (mailIndex >= 0 && setting[mailIndex+7][2] === "แอดมิน") {
    return {type: "admin",name:setting[mailIndex+7][3]};
  } else {
    return {type: "student",name:setting[mailIndex+7][3]};
  }
}

// ฟังก์ชันแสดงหน้าเว็บตามสิทธิ์ผู้ใช้
function doGet() {
  var role = checkUserRole();
  if (role.type === "teacher" || role.type === "admin") {
    userInfo = role;
    return HtmlService.createTemplateFromFile(setting[3][1]).evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle(setting[2][1]);
  } else if (role.type === "student") {
    userInfo = role;
    return HtmlService.createTemplateFromFile(setting[3][2]).evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle(setting[2][2]);
  } else {
    return HtmlService.createTemplateFromFile(setting[3][3]).evaluate()
    .addMetaTag('viewport', 'width=device-width, initial-scale=1')
    .setTitle(setting[2][3]);
  }
}

// ฟังก์ชันดึงข้อมูลงานตามช่วงเวลา
function getTasksByDateRange(dateObj) {
  var dataDate = JSON.parse(dateObj)
  var startDate = new Date(dataDate[0])
  var endDate = new Date(dataDate[1])

  Logger.log(startDate)
  Logger.log(endDate)
  
  var data = taskSheet.getDataRange().getDisplayValues();
  var filteredTasks = [];

  filteredTasks = data.filter(r=>(new Date(r[4]) >= startDate && new Date(r[5]) <= endDate) || (new Date(r[5]) >= startDate && new Date(r[4]) <= endDate))
  
  // for (var i = 1; i < data.length; i++) {
  //   var taskStartDate = new Date(data[i][2]);
  //   var taskEndDate = new Date(data[i][3]);
  //   if ((taskStartDate >= startDate && taskStartDate <= endDate) ||
  //       (taskEndDate >= startDate && taskEndDate <= endDate)) {
  //     filteredTasks.push(data[i]);
  //   }
  // }
  
  return filteredTasks;
}

// ฟังก์ชันสำหรับครูในการอัปเดตงาน
function saveTask(name, teacher, details, startDate, endDate, status) {
  taskSheet.appendRow(['', name, teacher, details, startDate, endDate, status]);
}

// ฟังก์ชันสำหรับแก้ไขอัพเดตงาน
function updateTask(obj) {
  var row = taskSheet.getRange("A1:A").getDisplayValues().map(r => r[0]).indexOf(obj.id)+1
  
  taskSheet.getRange(row,2,1,6).setValues([[
    obj.title,
    obj.name,
    obj.detail,
    obj.start,
    obj.end,
    obj.status
  ]])
}

// ฟังก์ชันลบกิจกรรม
function deleteTask(id) {
  var row = taskSheet.getRange("A1:A").getDisplayValues().map(r => r[0]).indexOf(id)+1
  console.log(row)
  taskSheet.deleteRow(row);
}

// ฟังก์ชันส่งข้อความแจ้งเตือนผ่าน Telegram
function sendTelegramNotification(chatId, message) {
  var token = setting[4][1];  // ใส่ API Token ของบอท
  var url = 'https://api.telegram.org/bot' + token;

  // การตั้งค่าส่งข้อความ
  var payload = {
    'chat_id': chatId,
    'text': message,
    // 'parse_mode': 'markdown',
    'parse_mode': 'HTML'
  };
  var options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload)
  };
  UrlFetchApp.fetch(url+ '/sendMessage', options); //ส่งข้อความ
}

// ฟังก์ชันเช็ควันส่งงานและส่งแจ้งเตือน
function checkDueTasksAndNotify() {
  var data = taskSheet.getDataRange().getDisplayValues();
  var today = new Date();
  var chatId = setting[4][3];  // ใส่ Chat ID ของผู้ใช้
  
  for (var i = 1; i < data.length; i++) {
    var dueDate = new Date(data[i][5]);
    var timeDiff = Math.floor((dueDate - today) / (1000 * 60 * 60 * 24))+1; // คำนวณจำนวนวัน
    if (timeDiff <= 7 && data[i][6] !== "เสร็จแล้ว") {  // หากงานไม่เสร็จและเหลือ 7 วัน
      var message
      if (timeDiff < 0) {
        message = "📝 <s>งาน '" + data[i][1] + "'</s> ของครู "+ data[i][2] + " ❌ <s>เลยวันกำหนดส่งแล้ว</s> " + timeDiff + " วัน"
      } else if (timeDiff == 0) {
        message = "📝 งาน '" + data[i][1] + "' ของครู "+ data[i][2] + " 📌 <b>ครบกำหนดส่งในวันนี้</b>"
      } else {
        message = "📝 งาน '" + data[i][1] + "' ของครู "+ data[i][2] + " 📅 <i>จะครบกำหนดส่งในอีก " + timeDiff + " วัน</i>";
      }
      sendTelegramNotification(chatId, message);
    }
  }
}

