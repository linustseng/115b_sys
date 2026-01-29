export function getCheckinErrorDisplay(error) {
  if (!error) {
    return null;
  }
  const normalized = String(error).toLowerCase();
  if (normalized.includes("window") || normalized.includes("closed") || normalized.includes("expired")) {
    return {
      title: "QRCode 已過期",
      message: "此活動的簽到時間已結束或尚未開始。",
      action: "請向現場承辦確認是否可協助補登。",
    };
  }
  if (normalized.includes("missing slug")) {
    return {
      title: "簽到連結不完整",
      message: "我們無法辨識此 QRCode。",
      action: "請重新掃描或向現場承辦索取正確連結。",
    };
  }
  if (normalized.includes("registration not found")) {
    return {
      title: "尚未完成報名",
      message: "找不到你的報名紀錄，無法簽到。",
      action: "請洽活動負責人協助處理。",
    };
  }
  if (normalized.includes("not attending") || normalized.includes("attendance not confirmed")) {
    return {
      title: "無法簽到",
      message: "目前回覆為不克出席或尚未確認出席。",
      action: "請洽活動負責人協助處理。",
    };
  }
  if (normalized.includes("already checked")) {
    return {
      title: "已完成簽到",
      message: "系統顯示你已完成簽到，歡迎入場。",
      action: "若有疑問請向現場承辦確認。",
    };
  }
  return {
    title: "簽到未完成",
    message: "系統暫時無法完成簽到。",
    action: "請稍後重試或請承辦協助。",
  };
}

export function mapRegistrationError(error) {
  const normalized = String(error || "").toLowerCase();
  if (normalized.includes("duplicate")) {
    return "你已完成過報名，無需重複送出。";
  }
  if (normalized.includes("full")) {
    return "活動名額已滿，請聯繫承辦確認候補。";
  }
  if (normalized.includes("window") || normalized.includes("closed")) {
    return "報名時間已截止或尚未開始。";
  }
  if (normalized.includes("event not found")) {
    return "活動資訊不存在，請重新確認連結。";
  }
  if (normalized.includes("registration link expired")) {
    return "此報名連結已失效，請向承辦索取新的連結。";
  }
  return "系統暫時無法完成報名，請稍後再試。";
}
