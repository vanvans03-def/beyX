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

        // Admin Detail
        "detail.share_link": "ลิงก์ลงทะเบียน",
        "detail.share_qr": "QR Code",
        "detail.ban_list": "รายการแบน (Ban List)",
        "detail.export_image": "บันทึกเป็นรูปภาพ",
        "detail.participants": "ผู้ลงทะเบียน ({count})",
        "detail.csv": "ส่งออก CSV",
        "detail.status": "สถานะ",
        "detail.type": "ประเภท",
        "detail.banned_parts": "ชิ้นส่วนที่ถูกแบน",

        // Tournament Types
        "type.U10": "U10",
        "type.NoMoreMeta": "No More Meta",
        "type.Open": "Open / Custom",

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

        // Admin Detail
        "detail.share_link": "Registration Link",
        "detail.share_qr": "QR Code",
        "detail.ban_list": "Ban List",
        "detail.export_image": "Export as Image",
        "detail.participants": "Participants ({count})",
        "detail.csv": "Export CSV",
        "detail.status": "Status",
        "detail.type": "Type",
        "detail.banned_parts": "Banned Parts",

        // Tournament Types
        "type.U10": "U10",
        "type.NoMoreMeta": "No More Meta",
        "type.Open": "Open / Custom",

        // General
        "gen.select": "Select...",
        "gen.delete": "Delete",
        "gen.close": "Close",
        "gen.save": "Save"
    }
};

export type Lang = keyof typeof locales;
export type LocaleKey = keyof typeof locales.TH;
