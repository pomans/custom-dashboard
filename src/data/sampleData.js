export const datasetLibrary = {
  monthlyBusiness: {
    id: 'monthlyBusiness',
    label: 'Monthly Business Overview',
    description: 'ยอดรายเดือนของลูกค้าแต่ละราย พร้อมหน่วยงานและเจ้าของ sales',
    fields: [
      { key: 'period', label: 'Period', type: 'category' },
      { key: 'customer', label: 'Customer', type: 'category' },
      { key: 'department', label: 'Department', type: 'category' },
      { key: 'salesOwner', label: 'Sales Owner', type: 'category' },
      { key: 'revenue', label: 'Revenue', type: 'number' },
      { key: 'cost', label: 'Cost', type: 'number' },
      { key: 'profit', label: 'Profit', type: 'number' }
    ],
    records: [
      { period: 'Jan', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', revenue: 12000, cost: 7800, profit: 4200 },
      { period: 'Jan', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', revenue: 9800, cost: 6200, profit: 3600 },
      { period: 'Feb', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', revenue: 14800, cost: 8400, profit: 6400 },
      { period: 'Feb', customer: 'Summit Corp.', department: 'Public Sector', salesOwner: 'Mali', revenue: 13200, cost: 7900, profit: 5300 },
      { period: 'Mar', customer: 'NexGen Co.', department: 'SMB', salesOwner: 'Pete', revenue: 13900, cost: 8100, profit: 5800 },
      { period: 'Mar', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', revenue: 17100, cost: 9800, profit: 7300 }
    ]
  },
  regionalPerformance: {
    id: 'regionalPerformance',
    label: 'Regional Performance',
    description: 'ยอดขายเปรียบเทียบกับเป้าหมาย โดยมีข้อมูลลูกค้า หน่วยงาน และ sales owner',
    fields: [
      { key: 'region', label: 'Region', type: 'category' },
      { key: 'customer', label: 'Customer', type: 'category' },
      { key: 'department', label: 'Department', type: 'category' },
      { key: 'salesOwner', label: 'Sales Owner', type: 'category' },
      { key: 'target', label: 'Target', type: 'number' },
      { key: 'actual', label: 'Actual', type: 'number' },
      { key: 'pipeline', label: 'Pipeline', type: 'number' }
    ],
    records: [
      { region: 'Bangkok', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', target: 180, actual: 196, pipeline: 48 },
      { region: 'Chiang Mai', customer: 'NexGen Co.', department: 'SMB', salesOwner: 'Pete', target: 120, actual: 112, pipeline: 37 },
      { region: 'Khon Kaen', customer: 'Summit Corp.', department: 'Public Sector', salesOwner: 'Mali', target: 95, actual: 104, pipeline: 25 },
      { region: 'Phuket', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', target: 130, actual: 141, pipeline: 31 }
    ]
  },
  marketingChannels: {
    id: 'marketingChannels',
    label: 'Marketing Channels',
    description: 'ผลตอบรับจากช่องทางการตลาดของลูกค้าแต่ละราย',
    fields: [
      { key: 'channel', label: 'Channel', type: 'category' },
      { key: 'customer', label: 'Customer', type: 'category' },
      { key: 'department', label: 'Department', type: 'category' },
      { key: 'salesOwner', label: 'Sales Owner', type: 'category' },
      { key: 'spend', label: 'Spend', type: 'number' },
      { key: 'leads', label: 'Leads', type: 'number' },
      { key: 'conversions', label: 'Conversions', type: 'number' }
    ],
    records: [
      { channel: 'Web Ads', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', spend: 5400, leads: 410, conversions: 68 },
      { channel: 'TikTok', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', spend: 4200, leads: 530, conversions: 72 },
      { channel: 'Email', customer: 'Summit Corp.', department: 'Public Sector', salesOwner: 'Mali', spend: 1800, leads: 210, conversions: 54 },
      { channel: 'Partner', customer: 'NexGen Co.', department: 'SMB', salesOwner: 'Pete', spend: 2600, leads: 160, conversions: 39 }
    ]
  },
  supportQueue: {
    id: 'supportQueue',
    label: 'Support Queue',
    description: 'สถานะ ticket support ที่เชื่อมกับลูกค้า หน่วยงาน และ sales owner',
    fields: [
      { key: 'priority', label: 'Priority', type: 'category' },
      { key: 'customer', label: 'Customer', type: 'category' },
      { key: 'department', label: 'Department', type: 'category' },
      { key: 'salesOwner', label: 'Sales Owner', type: 'category' },
      { key: 'opened', label: 'Opened', type: 'number' },
      { key: 'resolved', label: 'Resolved', type: 'number' },
      { key: 'breached', label: 'Breached SLA', type: 'number' }
    ],
    records: [
      { priority: 'Critical', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', opened: 18, resolved: 14, breached: 2 },
      { priority: 'High', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', opened: 31, resolved: 26, breached: 4 },
      { priority: 'Medium', customer: 'Summit Corp.', department: 'Public Sector', salesOwner: 'Mali', opened: 44, resolved: 38, breached: 5 },
      { priority: 'Low', customer: 'NexGen Co.', department: 'SMB', salesOwner: 'Pete', opened: 29, resolved: 25, breached: 1 }
    ]
  },
  productMix: {
    id: 'productMix',
    label: 'Product Mix',
    description: 'ยอดขายสินค้าแยกตามลูกค้า หน่วยงาน และผู้ดูแลการขาย',
    fields: [
      { key: 'category', label: 'Category', type: 'category' },
      { key: 'product', label: 'Product', type: 'category' },
      { key: 'customer', label: 'Customer', type: 'category' },
      { key: 'department', label: 'Department', type: 'category' },
      { key: 'salesOwner', label: 'Sales Owner', type: 'category' },
      { key: 'sales', label: 'Sales', type: 'number' },
      { key: 'margin', label: 'Margin', type: 'number' }
    ],
    records: [
      { category: 'Core', product: 'Analytics', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', sales: 320, margin: 110 },
      { category: 'Core', product: 'Billing', customer: 'NexGen Co.', department: 'SMB', salesOwner: 'Pete', sales: 260, margin: 90 },
      { category: 'Add-on', product: 'Automation', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', sales: 180, margin: 72 },
      { category: 'Add-on', product: 'Forecasting', customer: 'Summit Corp.', department: 'Public Sector', salesOwner: 'Mali', sales: 140, margin: 58 },
      { category: 'Service', product: 'Implementation', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', sales: 210, margin: 95 },
      { category: 'Service', product: 'Support', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', sales: 160, margin: 76 }
    ]
  },
  orderRecords: {
    id: 'orderRecords',
    label: 'Order Records',
    description: 'รายการคำสั่งซื้อที่เชื่อมด้วยลูกค้า หน่วยงาน และ sales owner',
    fields: [
      { key: 'orderId', label: 'Order ID', type: 'text' },
      { key: 'customer', label: 'Customer', type: 'category' },
      { key: 'department', label: 'Department', type: 'category' },
      { key: 'salesOwner', label: 'Sales Owner', type: 'category' },
      { key: 'status', label: 'Status', type: 'category' },
      { key: 'items', label: 'Items', type: 'number' },
      { key: 'amount', label: 'Amount', type: 'number' }
    ],
    records: [
      { orderId: 'SO-1001', customer: 'Acme Ltd.', department: 'Retail', salesOwner: 'Nina', status: 'Delivered', items: 12, amount: 1200 },
      { orderId: 'SO-1002', customer: 'NexGen Co.', department: 'SMB', salesOwner: 'Pete', status: 'Pending', items: 9, amount: 870 },
      { orderId: 'SO-1003', customer: 'Summit Corp.', department: 'Public Sector', salesOwner: 'Mali', status: 'Shipped', items: 15, amount: 1430 },
      { orderId: 'SO-1004', customer: 'Orbit Tech', department: 'Enterprise', salesOwner: 'Ton', status: 'Delivered', items: 8, amount: 990 }
    ]
  }
};

export const relationalKeys = ['customer', 'department', 'salesOwner'];

export const widgetCatalog = [
  { type: 'line', label: 'Line', dataset: 'monthlyBusiness', title: 'Revenue Trend' },
  { type: 'bar', label: 'Bar', dataset: 'regionalPerformance', title: 'Regional Performance' },
  { type: 'pie', label: 'Pie', dataset: 'marketingChannels', title: 'Channel Distribution' },
  { type: 'treemap', label: 'Treemap', dataset: 'productMix', title: 'Product Mix' },
  { type: 'table', label: 'Table', dataset: 'orderRecords', title: 'Order Records' },
  { type: 'label', label: 'Label', dataset: '', title: 'Label Text' },
  { type: 'date', label: 'Current Date', dataset: '', title: 'Today' }
];
