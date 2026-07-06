// i18n — TH/EN สำหรับ Custom Dashboard
// เก็บภาษาใน localStorage[LANG_STORAGE_KEY], default = 'th'
// ใช้: const { t, lang, setLang } = useLang(); return <span>{t('list.title')}</span>
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

const LANG_STORAGE_KEY = 'bi-dashboard.lang.v1';
const SUPPORTED = ['th', 'en'];
const DEFAULT_LANG = 'th';

const DICT = {
  th: {
    // ── List page ───────────────────────────────────────────────
    'list.title': 'Custom Dashboard',
    'list.subtitle': 'เลือกแดชบอร์ดเพื่อดูหรือแก้ไข',
    'list.count': 'แดชบอร์ด',
    'list.viewCard': 'มุมมองการ์ด',
    'list.viewList': 'มุมมองรายการ',
    'list.import': 'นำเข้า',
    'list.newDashboard': 'แดชบอร์ดใหม่',
    'list.download': 'ดาวน์โหลด',
    'list.delete': 'ลบ',
    'list.share': 'แชร์',
    'list.datasetCount': 'มี {n} ชุดข้อมูล',
    'list.sharedCount': 'แชร์กับ {n} คน',
    'list.sharedWithMe': 'แชร์ให้ฉัน',
    'list.emptyTitle': 'คุณยังไม่มีแดชบอร์ด',
    'list.emptySubtitle': 'เริ่มต้นสร้างแดชบอร์ดของคุณเอง เพื่อจัดเก็บและติดตามข้อมูลที่สนใจ',
    'list.loading': 'กำลังโหลดแดชบอร์ด…',

    // ── Topbar / toolbar ─────────────────────────────────────────
    'toolbar.back': 'รายการแดชบอร์ด',
    'toolbar.brand': 'สร้างแดชบอร์ด',
    'toolbar.save': 'บันทึก',
    'toolbar.saveTooltip': 'บันทึกแดชบอร์ด',
    'toolbar.enterEdit': 'เข้าสู่โหมดแก้ไข',
    'toolbar.exitEdit': 'ดูตัวอย่าง',
    'toolbar.exportJson': 'ส่งออก JSON',
    'toolbar.importJson': 'นำเข้า JSON',
    'toolbar.print': 'พิมพ์',
    'toolbar.downloadPdf': 'ดาวน์โหลด PDF',
    'toolbar.savePdf': 'บันทึกเป็น PDF',
    'toolbar.newDashboard': 'ใหม่',
    'toolbar.duplicate': 'ทำซ้ำ',
    'toolbar.deleteDashboard': 'ลบแดชบอร์ด',
    'toolbar.menu': 'เมนู',
    'toolbar.showSidebar': 'แสดงแผงวิดเจ็ต',
    'toolbar.hideSidebar': 'ซ่อนแผงวิดเจ็ต',
    'toolbar.fitScreen': 'พอดีหน้าจอ',
    'toolbar.zoomIn': 'ซูมเข้า',
    'toolbar.zoomOut': 'ซูมออก',
    'toolbar.resetZoom': 'คลิกเพื่อรีเซ็ตเป็น 100%',
    'toolbar.autoResize': 'ปรับขนาดอัตโนมัติ — ให้วิดเจ็ตพอดีความกว้างหน้าจอ',
    'toolbar.autoArrange': 'จัดเรียงอัตโนมัติ — จัดวางวิดเจ็ตไม่ให้ทับซ้อน',
    'toolbar.help': 'คู่มือการใช้งาน',
    'toolbar.selectDashboard': 'เลือกแดชบอร์ด',
    'toolbar.editName': 'แก้ไขชื่อแดชบอร์ด',
    'toolbar.namePlaceholder': 'ชื่อแดชบอร์ด…',
    'toolbar.dashboardGroup': 'แดชบอร์ด',
    'toolbar.fileGroup': 'ไฟล์',
    'toolbar.exportGroup': 'ส่งออก',
    'toolbar.lang': 'ภาษา',

    // ── Dialogs — common ─────────────────────────────────────────
    'dialog.cancel': 'ยกเลิก',
    'dialog.close': 'ปิด',
    'dialog.confirm': 'ยืนยัน',
    'dialog.save': 'บันทึก',
    'dialog.delete': 'ลบ',
    'dialog.remove': 'นำออก',
    'dialog.backToEdit': 'กลับไปแก้ต่อ',

    // ── New dashboard dialog ─────────────────────────────────────
    'newDash.title': 'เพิ่มแดชบอร์ด',
    'newDash.subtitle': 'ตั้งชื่อแดชบอร์ดใหม่ของคุณ',
    'newDash.nameLabel': 'ชื่อแดชบอร์ด',
    'newDash.namePlaceholder': 'ชื่อแดชบอร์ด…',
    'newDash.submit': 'สร้างแดชบอร์ด',
    'newDash.err.required': 'กรุณาระบุชื่อแดชบอร์ด',
    'newDash.err.tooShort': 'ชื่ออย่างน้อย 2 ตัวอักษร',
    'newDash.err.tooLong': 'ชื่อยาวเกิน 80 ตัวอักษร',
    'newDash.err.duplicate': 'มีแดชบอร์ดชื่อนี้อยู่แล้ว',

    // ── Delete dialog ────────────────────────────────────────────
    'delete.title': 'ลบแดชบอร์ด',
    'delete.confirm': 'ลบ "{name}"? การดำเนินการนี้ไม่สามารถยกเลิกได้',
    'delete.shared.title': 'นำออกจากรายการ',
    'delete.shared.confirm': 'นำ "{name}" ออกจากรายการของคุณ? (ไม่กระทบเจ้าของ — เปิดลิงก์แชร์ใหม่ได้)',

    // ── Save dialog ──────────────────────────────────────────────
    'save.title': 'บันทึกแดชบอร์ด',
    'save.confirm': 'ต้องการบันทึก "{name}" ลงระบบใช่หรือไม่?',
    'save.saving': 'กำลังบันทึก…',

    // ── Share dialog ─────────────────────────────────────────────
    'share.title': 'แชร์แดชบอร์ด',
    'share.subtitle': 'ใครก็ตามที่มีลิงก์นี้สามารถดู "{name}" ได้',
    'share.copy': 'คัดลอก',
    'share.copied': 'คัดลอกแล้ว ✓',
    'share.loading': 'กำลังสร้างลิงก์แชร์…',
    'share.error': 'สร้างลิงก์แชร์ไม่สำเร็จ',

    // ── Unsaved-change guard ────────────────────────────────────
    'unsaved.title': 'มีการเปลี่ยนแปลงที่ยังไม่บันทึก',
    'unsaved.confirm': 'ออกจากหน้านี้โดยไม่บันทึก? การเปลี่ยนแปลงทั้งหมดจะหายไป',
    'unsaved.leave': 'ออกโดยไม่บันทึก',

    // ── Toasts ───────────────────────────────────────────────────
    'toast.saved': 'บันทึกแดชบอร์ดแล้ว',
    'toast.saveFailed': 'บันทึกแดชบอร์ดไม่สำเร็จ',
    'toast.deleted': 'ลบแดชบอร์ดแล้ว',
    'toast.deleteFailed': 'ลบแดชบอร์ดไม่สำเร็จ',
    'toast.removed': 'นำแดชบอร์ดออกจากรายการแล้ว',
    'toast.removeFailed': 'นำออกจากรายการไม่สำเร็จ',
    'toast.needWidget': 'ไม่สามารถสร้างแดชบอร์ดใหม่ได้ — กรุณาเพิ่มวิดเจ็ตอย่างน้อยหนึ่งชิ้นก่อน',

    // ── Filter panel ────────────────────────────────────────────
    'filter.title': 'ตัวกรอง',
    'filter.subtitle': 'ควบคุมทุกวิดเจ็ต — ตลาด, ปี, ไตรมาส, อุตสาหกรรม และภูมิศาสตร์',
    'filter.market': 'ตลาด',
    'filter.marketIntl': 'ต่างชาติ',
    'filter.marketDomestic': 'ในประเทศ',
    'filter.yearBasis': 'ฐานปี',
    'filter.yearCalendar': 'ปฏิทิน',
    'filter.yearFiscal': 'งบประมาณ',
    'filter.year': 'ปี',
    'filter.yearSingle': 'ปีเดียว',
    'filter.yearRange': 'ช่วงปี',
    'filter.quarter': 'ไตรมาส',
    'filter.industry': 'อุตสาหกรรม',
    'filter.continent': 'ทวีป',
    'filter.country': 'ประเทศ / สัญชาติ',
    'filter.all': 'ทั้งหมด',

    // ── Wizard onboarding (tutorial) ────────────────────────────
    'wizard.skip': 'ข้าม',
    'wizard.back': '← ย้อนกลับ',
    'wizard.next': 'ถัดไป →',
    'wizard.done': '🚀 เริ่มเลย!',
    'wizard.goStep': 'ไปขั้นที่ {n}',
    'wizard.s1.topic': 'ภาพรวม',
    'wizard.s1.title': 'สร้างแดชบอร์ด',
    'wizard.s1.subtitle': 'สร้างแดชบอร์ดข้อมูล MICE ของคุณเอง — ไม่ต้องเขียนโค้ด',
    'wizard.s1.b1': 'ลากวิดเจ็ตจากแผงวิดเจ็ตลงบนพื้นที่',
    'wizard.s1.b2': 'ปรับขนาดและจัดเรียงได้อิสระ',
    'wizard.s1.b3': 'กรองทุกวิดเจ็ตพร้อมกันด้วยแผงตัวกรองหลัก',
    'wizard.s2.topic': 'ขั้นที่ 1 — แผงวิดเจ็ต',
    'wizard.s2.title': 'ค้นหาวิดเจ็ต',
    'wizard.s2.subtitle': 'แผงด้านซ้ายจัดวิดเจ็ตเป็นกลุ่ม',
    'wizard.s2.b1': 'คลิกโฟลเดอร์เพื่อขยายและดูวิดเจ็ตที่มี',
    'wizard.s2.b2': 'วิดเจ็ตสำเร็จรูป (ข้อมูล MICE) ตั้งค่าไว้ล่วงหน้าแล้ว',
    'wizard.s2.b3': 'วิดเจ็ตแบบกำหนดเองให้คุณเลือกฟิลด์ได้เอง',
    'wizard.s3.topic': 'ขั้นที่ 2 — ลากลงพื้นที่',
    'wizard.s3.title': 'ลากและวาง',
    'wizard.s3.subtitle': 'วางวิดเจ็ตที่ไหนก็ได้บนพื้นที่',
    'wizard.s3.b1': 'ลากวิดเจ็ตจากแผงวิดเจ็ตลงบนพื้นที่',
    'wizard.s3.b2': 'ปล่อยเมาส์เพื่อวางตำแหน่ง',
    'wizard.s3.b3': 'วิดเจ็ตจะปรากฏพร้อมข้อมูลตัวอย่างทันที',
    'wizard.s4.topic': 'ขั้นที่ 3 — ปรับขนาดและย้าย',
    'wizard.s4.title': 'จัดวางพื้นที่ของคุณ',
    'wizard.s4.subtitle': 'วิดเจ็ตจะเกาะกริด — ปรับขนาดและย้ายตำแหน่งได้อิสระ',
    'wizard.s4.b1': 'ลากมุมของวิดเจ็ตเพื่อปรับขนาด',
    'wizard.s4.b2': 'ลากตรงกลางวิดเจ็ตเพื่อย้ายตำแหน่ง',
    'wizard.s4.b3': 'ใช้ปุ่ม "จัดเรียงอัตโนมัติ" เพื่อจัดวางไม่ให้ทับซ้อน',
    'wizard.s5.topic': 'ขั้นที่ 4 — ตัวกรองหลัก',
    'wizard.s5.title': 'กรองทุกวิดเจ็ตพร้อมกัน',
    'wizard.s5.subtitle': 'แผงตัวกรองด้านบนควบคุมทุกวิดเจ็ตพร้อมกัน',
    'wizard.s5.b1': 'เลือกตลาด (ต่างชาติ/ในประเทศ), ปี, ไตรมาส, อุตสาหกรรม',
    'wizard.s5.b2': 'ทุกวิดเจ็ตจะอัปเดตข้อมูลอัตโนมัติ',
    'wizard.s5.b3': 'กดปุ่มล้างเพื่อรีเซ็ตตัวกรองทั้งหมด',
    'wizard.s6.topic': 'ขั้นที่ 5 — การตั้งค่าวิดเจ็ต',
    'wizard.s6.title': 'ตั้งค่าวิดเจ็ต',
    'wizard.s6.subtitle': 'เลื่อนเมาส์ไปที่วิดเจ็ต แล้วคลิก ⚙ เพื่อเปิดการตั้งค่า',
    'wizard.s6.b1': 'เปลี่ยนชื่อ, สี, และประเภทกราฟได้',
    'wizard.s6.b2': 'เลือกฟิลด์ข้อมูลสำหรับวิดเจ็ตแบบกำหนดเอง',
    'wizard.s6.b3': 'ปุ่ม 🗑 เพื่อลบวิดเจ็ต',
    'wizard.s7.topic': 'ขั้นที่ 6 — ดูตัวอย่างและส่งออก',
    'wizard.s7.title': 'ดูตัวอย่าง บันทึก และส่งออก',
    'wizard.s7.subtitle': 'สลับระหว่างโหมดแก้ไขและดูตัวอย่างได้ตลอดเวลา',
    'wizard.s7.b1': 'ปุ่ม 👁 เพื่อดูตัวอย่าง (ซ่อนตัวช่วยแก้ไข)',
    'wizard.s7.b2': 'ปุ่มบันทึกเพื่อเก็บลงฐานข้อมูล',
    'wizard.s7.b3': 'ดาวน์โหลด PDF/JSON สำหรับแชร์แบบออฟไลน์',
    'wizard.s8.topic': 'พร้อมแล้ว',
    'wizard.s8.title': 'คุณพร้อมแล้ว!',
    'wizard.s8.subtitle': 'เริ่มสร้างแดชบอร์ดแรกของคุณได้เลย',
    'wizard.s8.b1': 'คลิก ✎ (มุมขวาบน) เพื่อเข้าสู่โหมดแก้ไข',
    'wizard.s8.b2': 'เปิดแผงวิดเจ็ต เลือกวิดเจ็ต แล้วลากลงบนพื้นที่',
    'wizard.s8.b3': 'มีข้อสงสัย? คลิกปุ่ม ? เพื่อเปิดคู่มือนี้อีกครั้ง',

    // ── PDF download confirmation ────────────────────────────────
    'pdf.confirmTitle': 'ดาวโหลด PDF',
    'pdf.confirmMessage': 'เอกสารในรูปแบบ PDF จัดทำเป็นภาษาอังกฤษเท่านั้น',
    'pdf.download': 'ดาวน์โหลด',
    'pdf.generating': 'กำลังสร้าง PDF…',
  },

  en: {
    // ── List page ───────────────────────────────────────────────
    'list.title': 'Custom Dashboard',
    'list.subtitle': 'Select a dashboard to view or edit',
    'list.count': 'Dashboards',
    'list.viewCard': 'Card view',
    'list.viewList': 'List view',
    'list.import': 'Import',
    'list.newDashboard': 'New dashboard',
    'list.download': 'Download',
    'list.delete': 'Delete',
    'list.share': 'Share',
    'list.datasetCount': '{n} datasets',
    'list.sharedCount': 'Shared with {n}',
    'list.sharedWithMe': 'Shared with me',
    'list.emptyTitle': 'You have no dashboards yet',
    'list.emptySubtitle': 'Start creating your own dashboard to collect and track data you care about',
    'list.loading': 'Loading dashboards…',

    // ── Topbar / toolbar ─────────────────────────────────────────
    'toolbar.back': 'Dashboard list',
    'toolbar.brand': 'Dashboard Builder',
    'toolbar.save': 'Save',
    'toolbar.saveTooltip': 'Save dashboard',
    'toolbar.enterEdit': 'Enter edit mode',
    'toolbar.exitEdit': 'Preview',
    'toolbar.exportJson': 'Export JSON',
    'toolbar.importJson': 'Import JSON',
    'toolbar.print': 'Print',
    'toolbar.downloadPdf': 'Download PDF',
    'toolbar.savePdf': 'Save as PDF',
    'toolbar.newDashboard': 'New',
    'toolbar.duplicate': 'Duplicate',
    'toolbar.deleteDashboard': 'Delete dashboard',
    'toolbar.menu': 'Menu',
    'toolbar.showSidebar': 'Show widget panel',
    'toolbar.hideSidebar': 'Hide widget panel',
    'toolbar.fitScreen': 'Fit to screen',
    'toolbar.zoomIn': 'Zoom in',
    'toolbar.zoomOut': 'Zoom out',
    'toolbar.resetZoom': 'Click to reset to 100%',
    'toolbar.autoResize': 'Auto-resize — fit widgets to screen width',
    'toolbar.autoArrange': 'Auto-arrange — organize widgets without overlap',
    'toolbar.help': 'User guide',
    'toolbar.selectDashboard': 'Select dashboard',
    'toolbar.editName': 'Edit dashboard name',
    'toolbar.namePlaceholder': 'Dashboard name…',
    'toolbar.dashboardGroup': 'Dashboard',
    'toolbar.fileGroup': 'File',
    'toolbar.exportGroup': 'Export',
    'toolbar.lang': 'Language',

    // ── Dialogs — common ─────────────────────────────────────────
    'dialog.cancel': 'Cancel',
    'dialog.close': 'Close',
    'dialog.confirm': 'Confirm',
    'dialog.save': 'Save',
    'dialog.delete': 'Delete',
    'dialog.remove': 'Remove',
    'dialog.backToEdit': 'Keep editing',

    // ── New dashboard dialog ─────────────────────────────────────
    'newDash.title': 'Add dashboard',
    'newDash.subtitle': 'Name your new dashboard',
    'newDash.nameLabel': 'Dashboard name',
    'newDash.namePlaceholder': 'Dashboard name…',
    'newDash.submit': 'Create dashboard',
    'newDash.err.required': 'Please enter a dashboard name',
    'newDash.err.tooShort': 'Name must be at least 2 characters',
    'newDash.err.tooLong': 'Name must be under 80 characters',
    'newDash.err.duplicate': 'A dashboard with this name already exists',

    // ── Delete dialog ────────────────────────────────────────────
    'delete.title': 'Delete dashboard',
    'delete.confirm': 'Delete "{name}"? This action cannot be undone.',
    'delete.shared.title': 'Remove from list',
    'delete.shared.confirm': 'Remove "{name}" from your list? (Owner is unaffected — you can reopen the share link)',

    // ── Save dialog ──────────────────────────────────────────────
    'save.title': 'Save dashboard',
    'save.confirm': 'Save "{name}" to the system?',
    'save.saving': 'Saving…',

    // ── Share dialog ─────────────────────────────────────────────
    'share.title': 'Share dashboard',
    'share.subtitle': 'Anyone with this link can view "{name}"',
    'share.copy': 'Copy',
    'share.copied': 'Copied ✓',
    'share.loading': 'Generating share link…',
    'share.error': 'Failed to generate share link',

    // ── Unsaved-change guard ────────────────────────────────────
    'unsaved.title': 'Unsaved changes',
    'unsaved.confirm': 'Leave this page without saving? All changes will be lost.',
    'unsaved.leave': 'Leave without saving',

    // ── Toasts ───────────────────────────────────────────────────
    'toast.saved': 'Dashboard saved',
    'toast.saveFailed': 'Failed to save dashboard',
    'toast.deleted': 'Dashboard deleted',
    'toast.deleteFailed': 'Failed to delete dashboard',
    'toast.removed': 'Dashboard removed from your list',
    'toast.removeFailed': 'Failed to remove from list',
    'toast.needWidget': 'Cannot create a new dashboard — please add at least one widget first',

    // ── Filter panel ────────────────────────────────────────────
    'filter.title': 'Filters',
    'filter.subtitle': 'Controls every widget — market, year, quarter, industry & geography',
    'filter.market': 'Market',
    'filter.marketIntl': 'International',
    'filter.marketDomestic': 'Domestic',
    'filter.yearBasis': 'Year Basis',
    'filter.yearCalendar': 'Calendar',
    'filter.yearFiscal': 'Fiscal',
    'filter.year': 'Year',
    'filter.yearSingle': 'Single year',
    'filter.yearRange': 'Year range',
    'filter.quarter': 'Quarter',
    'filter.industry': 'Industry',
    'filter.continent': 'Continent',
    'filter.country': 'Country / Nationality',
    'filter.all': 'All',

    // ── Wizard onboarding (tutorial) ────────────────────────────
    'wizard.skip': 'Skip',
    'wizard.back': '← Back',
    'wizard.next': 'Next →',
    'wizard.done': '🚀 Start!',
    'wizard.goStep': 'Go to step {n}',
    'wizard.s1.topic': 'Overview',
    'wizard.s1.title': 'Dashboard Builder',
    'wizard.s1.subtitle': 'Build your own MICE data dashboard — no code required',
    'wizard.s1.b1': 'Drag widgets from the panel onto the canvas',
    'wizard.s1.b2': 'Resize and rearrange freely',
    'wizard.s1.b3': 'Filter every widget at once with the main filter panel',
    'wizard.s2.topic': 'Step 1 — Widget panel',
    'wizard.s2.title': 'Browse widgets',
    'wizard.s2.subtitle': 'The left panel groups widgets by category',
    'wizard.s2.b1': 'Click a folder to expand and see available widgets',
    'wizard.s2.b2': 'Ready-made widgets (MICE data) are pre-configured',
    'wizard.s2.b3': 'Custom widgets let you pick fields yourself',
    'wizard.s3.topic': 'Step 2 — Drag onto canvas',
    'wizard.s3.title': 'Drag & drop',
    'wizard.s3.subtitle': 'Place widgets anywhere on the canvas',
    'wizard.s3.b1': 'Drag a widget from the panel onto the canvas',
    'wizard.s3.b2': 'Release to drop into position',
    'wizard.s3.b3': 'Widget appears immediately with sample data',
    'wizard.s4.topic': 'Step 3 — Resize & move',
    'wizard.s4.title': 'Arrange your space',
    'wizard.s4.subtitle': 'Widgets snap to the grid — resize and move freely',
    'wizard.s4.b1': 'Drag widget corners to resize',
    'wizard.s4.b2': 'Drag the widget center to reposition',
    'wizard.s4.b3': 'Use "Auto-arrange" to prevent overlaps',
    'wizard.s5.topic': 'Step 4 — Main filters',
    'wizard.s5.title': 'Filter every widget together',
    'wizard.s5.subtitle': 'The top filter panel controls every widget at once',
    'wizard.s5.b1': 'Choose market (International/Domestic), year, quarter, industry',
    'wizard.s5.b2': 'Every widget updates automatically',
    'wizard.s5.b3': 'Press clear to reset all filters',
    'wizard.s6.topic': 'Step 5 — Widget settings',
    'wizard.s6.title': 'Configure widgets',
    'wizard.s6.subtitle': 'Hover a widget and click ⚙ to open settings',
    'wizard.s6.b1': 'Change name, colors, and chart type',
    'wizard.s6.b2': 'Pick data fields for custom widgets',
    'wizard.s6.b3': '🗑 button to delete the widget',
    'wizard.s7.topic': 'Step 6 — Preview & export',
    'wizard.s7.title': 'Preview, save, and export',
    'wizard.s7.subtitle': 'Switch between edit and preview mode anytime',
    'wizard.s7.b1': '👁 button to preview (hides edit helpers)',
    'wizard.s7.b2': 'Save button to persist to the database',
    'wizard.s7.b3': 'Download PDF/JSON for offline sharing',
    'wizard.s8.topic': 'Ready',
    'wizard.s8.title': "You're all set!",
    'wizard.s8.subtitle': 'Start building your first dashboard',
    'wizard.s8.b1': 'Click ✎ (top right) to enter edit mode',
    'wizard.s8.b2': 'Open the widget panel, pick a widget, drag onto the canvas',
    'wizard.s8.b3': 'Questions? Click the ? button to reopen this guide',

    // ── PDF download confirmation ────────────────────────────────
    'pdf.confirmTitle': 'Download PDF',
    'pdf.confirmMessage': 'PDF documents are generated in English only',
    'pdf.download': 'Download',
    'pdf.generating': 'Generating PDF…',
  },
};

function readStoredLang() {
  if (typeof window === 'undefined') return DEFAULT_LANG;
  try {
    const v = window.localStorage.getItem(LANG_STORAGE_KEY);
    return SUPPORTED.includes(v) ? v : DEFAULT_LANG;
  } catch { return DEFAULT_LANG; }
}

function writeStoredLang(lang) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LANG_STORAGE_KEY, lang); } catch { /* private/quota */ }
}

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => readStoredLang());

  const setLang = useCallback((next) => {
    if (!SUPPORTED.includes(next)) return;
    setLangState(next);
    writeStoredLang(next);
  }, []);

  const t = useCallback((key, params) => {
    const table = DICT[lang] || DICT[DEFAULT_LANG];
    let s = table[key] ?? DICT[DEFAULT_LANG][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.replaceAll(`{${k}}`, String(v));
      }
    }
    return s;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t, supported: SUPPORTED }), [lang, setLang, t]);

  // sync html lang attribute (accessibility, browser text-to-speech, etc.)
  useEffect(() => {
    if (typeof document !== 'undefined') document.documentElement.lang = lang;
  }, [lang]);

  return <LangContext.Provider value={value}>{children}</LangContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within <LangProvider>');
  return ctx;
}
