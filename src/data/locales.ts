export const locales = {
    TH: {
        // Registration
        "reg.title": "ลงทะเบียนการแข่งขัน", // Registration
        "reg.placeholder.name": "กรอกชื่อที่ใช้ในการแข่งขัน", // Enter your Display Name
        "reg.label.name": "ชื่อผู้เล่น", // Player Name
        "reg.mode.u10": "รุ่น U10 (แต้ม)", // U10 (Points)
        "reg.mode.nmm": "รุ่น No More Meta", // No More Meta
        "reg.deck.main": "เด็คหลัก", // Main Deck
        "reg.deck.reserve": "เด็คสำรอง", // Reserve Decks
        "reg.deck.reserve_item": "เด็คสำรอง {n}",
        "reg.btn.add_reserve": "เพิ่มเด็คสำรอง", // Add Reserve Deck
        "reg.btn.submit": "ยืนยันการลงทะเบียน", // Complete Registration,
        "reg.btn.loading": "กำลังบันทึก...",
        "reg.btn.view_bracket": "ดูสายการแข่งขัน", // View Bracket
        "reg.alert.final": "การลงทะเบียนถือเป็นที่สิ้นสุด หากต้องการแก้ไขกรุณาติดต่อผู้จัดงาน",
        "reg.success": "ลงทะเบียนสำเร็จ",
        "reg.success.desc": "คุณได้ลงทะเบียนสำหรับการแข่งขันนี้แล้ว",
        "reg.closed": "ปิดรับสมัคร",
        "reg.closed.desc": "การแข่งขันนี้ปิดรับสมัครแล้ว",
        "reg.validation.incomplete": "จัดเด็คไม่ครบ",
        "reg.validation.duplicate": "เบย์ซ้ำกัน",
        "reg.validation.points": "{pts}/10 แต้ม",
        "reg.validation.banned": "มีชิ้นส่วนต้องห้าม",
        "reg.success.title": "ลงทะเบียนสำเร็จ!",
        "reg.complete": "การลงทะเบียนเสร็จสมบูรณ์",
        "reg.locked": "ข้อมูลของคุณถูกบันทึกแล้ว",
        "reg.player_profile": "ข้อมูลผู้เล่น",
        "reg.final_warning": "การลงทะเบียนถือเป็นที่สิ้นสุด หากต้องการแก้ไขกรุณาติดต่อผู้จัดงาน",
        "reg.player_name": "ชื่อผู้เล่น",
        "reg.banned": "โดนแบน",
        "reg.select": "เลือก...",
        "reg.selector.main": "เบย์หลัก {n}",
        "reg.selector.reserve": "เด็คสำรอง {d} - เบย์ {n}",
        "reg.error.name": "กรุณากรอกชื่อของคุณ",
        "reg.error.failed": "การลงทะเบียนล้มเหลว",
        "reg.error.generic": "เกิดข้อผิดพลาดบางอย่าง",
        "reg.error.name_exists": "ชื่อนี้ถูกใช้ไปแล้ว",
        "reg.success.name_available": "ชื่อนี้ใช้ได้",

        // Admin
        "admin.title": "จัดการทัวร์นาเมนต์",
        "admin.create.title": "สร้างทัวร์นาเมนต์ใหม่",
        "admin.create.placeholder": "ชื่อทัวร์นาเมนต์ (เช่น Jan Weekly #1)",
        "admin.create.btn": "สร้าง",
        "admin.list.active": "ทัวร์นาเมนต์ที่กำลังดำเนินการ",
        "admin.list.past": "ทัวร์นาเมนต์ที่จบแล้ว",
        "admin.list.empty": "ไม่มีทัวร์นาเมนต์ที่เปิดอยู่",
        "admin.manage": "จัดการ",
        "admin.view_history": "ดูประวัติ",
        "admin.end_confirm_title": "จบการแข่งขัน?",
        "admin.end_confirm_desc": "คุณแน่ใจหรือไม่ที่จะจบการแข่งขัน \"{name}\"? ผู้เล่นจะลงทะเบียนไม่ได้อีก",
        "admin.end_btn": "จบการแข่งขัน",
        "admin.error.delete_started": "ไม่สามารถลบได้เนื่องจากการแข่งเริ่มไปแล้ว โปรด รีเซ็ตการแข่ง เพื่อแก้ไข",

        // Admin Detail
        "detail.share_link": "ลิงก์ลงทะเบียน",
        "detail.share_qr": "QR Code",
        "detail.ban_list": "รายการแบน (Ban List)",
        "detail.export_image": "บันทึกเป็นรูปภาพ",
        "detail.participants": "ผู้ลงทะเบียน ({count})",
        "detail.csv": "ส่งออก CSV",
        "detail.status": "สถานะ",
        "detail.type": "ประเภท",
        "detail.rules_title": "กฎกติกาการแข่งขัน",
        "detail.banned_parts": "ชิ้นส่วนที่ถูกแบน",

        // Admin Tournament Control
        "admin.control.title": "จัดการทัวร์นาเมนต์",
        "admin.control.desc": "จัดการสายการแข่งขัน, สถานะ, และรีเซ็ตแทร็กเกอร์",
        "admin.btn.end": "จบการแข่งขัน",
        "admin.btn.completed": "จบการแข่งขันแล้ว",
        "admin.btn.reset": "รีเซ็ต",
        "admin.btn.setup": "เริ่มต้นการแข่งขัน",
        "admin.btn.generating": "กำลังสร้าง...",
        "admin.btn.invite": "สร้างการ์ดเชิญ",
        "admin.btn.creating_invite": "กำลังสร้าง...",

        // Admin Settings Modal
        "admin.settings.title": "ตั้งค่าทัวร์นาเมนต์",
        "admin.settings.format": "รูปแบบการแข่งขัน",
        "admin.settings.shuffle": "สุ่ม / สลับตำแหน่งผู้เล่น",
        "admin.settings.player_count": "กำลังสร้างสายสำหรับ {count} ผู้เล่น",
        "admin.settings.start": "เริ่มการแข่งขัน",
        "admin.settings.creating_challonge": "กำลังเชื่อมต่อ Challonge...",

        "admin.matches.title": "การแข่งขันที่กำลังแข่ง",
        "admin.matches.refresh": "รีเฟรชผล",
        "admin.matches.loading": "กำลังโหลด...",
        "admin.matches.empty": "ไม่พบการแข่งขัน",
        "admin.matches.round": "รอบที่ {n}",
        "admin.matches.win": "ชนะ",
        "admin.matches.view_all": "ดูทั้งหมด",

        "admin.modal.invite_created": "สร้างการ์ดเชิญสำเร็จ",
        "admin.modal.ban_created": "สร้างรูป Ban List สำเร็จ",
        "admin.modal.close": "ปิด",
        "admin.modal.download": "ดาวน์โหลดรูปภาพ",
        "admin.modal.download_ban": "ดาวน์โหลด Ban List",

        "admin.matches.judge": "ตัดสิน",
        "admin.matches.judging": "กำลังตัดสิน",
        "admin.matches.release": "ยกเลิกการตัดสิน",
        "admin.matches.locked_by": "ตัดสินโดย {name}",
        "admin.matches.confirm_win": "ยืนยันผู้ชนะ",
        "admin.matches.win_confirm_text_prefix": "ให้",
        "admin.matches.win_confirm_text_suffix": "ชนะ?",

        "type.U10": "3 Bey Under 10 Point",
        "type.NoMoreMeta": "No More Meta",
        "type.Open": "Open",
        "type.Standard": "Open",

        // General
        "gen.select": "เลือก...",
        "gen.delete": "ลบ",
        "gen.close": "ปิด",
        "gen.save": "บันทึก"
    },
    EN: {
        // Registration
        "reg.title": "Tournament Registration",
        "reg.placeholder.name": "Enter your Display Name",
        "reg.label.name": "Player Name",
        "reg.mode.u10": "U10 (Points)",
        "reg.mode.nmm": "No More Meta",
        "reg.deck.main": "Main Deck",
        "reg.deck.reserve": "Reserve Decks",
        "reg.deck.reserve_item": "Reserve Deck {n}",
        "reg.btn.add_reserve": "Add Reserve Deck",
        "reg.btn.submit": "Complete Registration",
        "reg.btn.loading": "Registering...",
        "reg.btn.view_bracket": "View Bracket",
        "reg.alert.final": "Registration is final. Contact the Tournament Organizer for changes.",
        "reg.success": "Registration Complete",
        "reg.success.desc": "You are registered for this tournament.",
        "reg.closed": "Tournament Ended",
        "reg.closed.desc": "Registration for this event is closed.",
        "reg.validation.incomplete": "Incomplete Deck",
        "reg.validation.duplicate": "Duplicate Blades",
        "reg.validation.points": "{pts}/10 pts",
        "reg.validation.banned": "Banned Item",
        "reg.success.title": "Registered!",
        "reg.complete": "Registration Complete",
        "reg.locked": "Your entry has been locked.",
        "reg.player_profile": "Player Profile",
        "reg.final_warning": "Registration is final. Contact the Tournament Organizer for changes.",
        "reg.player_name": "Player Name",
        "reg.banned": "Banned",
        "reg.select": "Select...",
        "reg.selector.main": "Main Bey {n}",
        "reg.selector.reserve": "Res {d} - Bey {n}",
        "reg.error.name": "Please enter your name.",
        "reg.error.failed": "Registration failed",
        "reg.error.generic": "Something went wrong.",
        "reg.error.name_exists": "Name already exists",
        "reg.success.name_available": "Name is available",

        // Admin
        "admin.title": "Tournament Manager",
        "admin.create.title": "Create New Tournament",
        "admin.create.placeholder": "Tournament Name (e.g. Jan Weekly #1)",
        "admin.create.btn": "Create",
        "admin.list.active": "Active Tournaments",
        "admin.list.past": "Past Tournaments",
        "admin.list.empty": "No active tournaments.",
        "admin.manage": "Manage",
        "admin.view_history": "View History",
        "admin.end_confirm_title": "End Tournament?",
        "admin.end_confirm_desc": "Are you sure you want to end \"{name}\"? This will disable new registrations immediately.",
        "admin.end_btn": "End Tournament",
        "admin.error.delete_started": "Cannot delete players because the tournament has started. Please reset the tournament to edit.",

        // Admin Detail
        "detail.share_link": "Registration Link",
        "detail.share_qr": "QR Code",
        "detail.ban_list": "Ban List",
        "detail.export_image": "Export as Image",
        "detail.participants": "Participants ({count})",
        "detail.csv": "Export CSV",
        "detail.status": "Status",
        "detail.type": "Type",
        "detail.rules_title": "Tournament Rules",
        "detail.banned_parts": "Banned Parts",

        // Admin Tournament Control
        "admin.control.title": "Tournament Control",
        "admin.control.desc": "Manage bracket, status, and reset tracker.",
        "admin.btn.end": "End Tournament",
        "admin.btn.completed": "Completed",
        "admin.btn.reset": "Reset",
        "admin.btn.setup": "Start Tournament",
        "admin.btn.generating": "Generating...",
        "admin.btn.invite": "Create Invite Card",
        "admin.btn.creating_invite": "Creating...",

        // Admin Settings Modal
        "admin.settings.title": "Tournament Settings",
        "admin.settings.format": "Format",
        "admin.settings.shuffle": "Randomize / Shuffle Participants",
        "admin.settings.player_count": "Creating bracket for {count} players.",
        "admin.settings.start": "Start Tournament",
        "admin.settings.creating_challonge": "Creating on Challonge...",

        "admin.matches.title": "Active Matches",
        "admin.matches.refresh": "Refresh Matches",
        "admin.matches.loading": "Loading matches...",
        "admin.matches.empty": "No active matches found.",
        "admin.matches.round": "Round {n}",
        "admin.matches.win": "Win",
        "admin.matches.view_all": "View All",

        "admin.modal.invite_created": "Invite Card Created",
        "admin.modal.ban_created": "Ban List Image Created",
        "admin.modal.close": "Close",
        "admin.modal.download": "Download Image",
        "admin.modal.download_ban": "Download Ban List",

        "admin.matches.judge": "Judge",
        "admin.matches.judging": "Judging",
        "admin.matches.release": "Release Match",
        "admin.matches.locked_by": "Locked by {name}",
        "admin.matches.confirm_win": "Confirm Winner",
        "admin.matches.win_confirm_text_prefix": "Declare",
        "admin.matches.win_confirm_text_suffix": "winner?",

        "type.U10": "3 Bey Under 10 Point",
        "type.NoMoreMeta": "No More Meta",
        "type.Open": "Open",
        "type.Standard": "Open",

        // General
        "gen.select": "Select...",
        "gen.delete": "Delete",
        "gen.close": "Close",
        "gen.save": "Save"
    }
};

export type Lang = keyof typeof locales;
export type LocaleKey = keyof typeof locales.TH;
