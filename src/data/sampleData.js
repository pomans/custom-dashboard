const MICE_QUARTER_LABELS = {
  calendar: ['Q1 (Jan - Mar)', 'Q2 (Apr - Jun)', 'Q3 (Jul - Sep)', 'Q4 (Oct - Dec)'],
  fiscal: ['Q1 (Oct - Dec)', 'Q2 (Jan - Mar)', 'Q3 (Apr - Jun)', 'Q4 (Jul - Sep)']
};

const MICE_INDUSTRIES = ['Meetings', 'Incentives', 'Conventions', 'Exhibitions', 'Mega Events'];

const MICE_COUNTRIES = [
  { country: 'Thailand', continent: 'Asia', market: 'Domestic' },
  { country: 'China', continent: 'Asia', market: 'International' },
  { country: 'Japan', continent: 'Asia', market: 'International' },
  { country: 'Singapore', continent: 'Asia', market: 'International' },
  { country: 'Malaysia', continent: 'Asia', market: 'International' },
  { country: 'India', continent: 'Asia', market: 'International' },
  { country: 'Germany', continent: 'Europe', market: 'International' },
  { country: 'United States', continent: 'North America', market: 'International' }
];

const MICE_MARKET_WEIGHTS = {
  Domestic: 0.82,
  International: 1.18
};

const MICE_INDUSTRY_WEIGHTS = {
  Meetings: 1,
  Incentives: 0.86,
  Conventions: 1.08,
  Exhibitions: 1.18,
  'Mega Events': 1.32
};

const MICE_COUNTRY_WEIGHTS = {
  Thailand: 1.1,
  China: 1.35,
  Japan: 1.18,
  Singapore: 0.96,
  Malaysia: 0.9,
  India: 1.02,
  Germany: 0.88,
  'United States': 0.83
};

const createMiceStatisticsRecords = () => {
  const records = [];
  const years = Array.from({ length: 20 }, (_, index) => 2007 + index);
  const yearlyTrend = {
    2007: 0.96,
    2008: 0.95,
    2009: 0.95,
    2010: 0.98,
    2011: 1.05,
    2012: 1.13,
    2013: 1.18,
    2014: 1.12,
    2015: 1.15,
    2016: 1.19,
    2017: 1.23,
    2018: 1.28,
    2019: 1.14,
    2020: 0.28,
    2021: 0.04,
    2022: 1.02,
    2023: 0.45,
    2024: 0.62,
    2025: 0.42,
    2026: 0.22
  };

  years.forEach((year, yearIndex) => {
    ['calendar', 'fiscal'].forEach((yearMode) => {
      MICE_QUARTER_LABELS[yearMode].forEach((quarterLabel, quarterIndex) => {
        MICE_COUNTRIES.forEach((countryItem, countryIndex) => {
          const availableMarkets = countryItem.market === 'Domestic' ? ['Domestic'] : ['International'];

          availableMarkets.forEach((market) => {
            MICE_INDUSTRIES.forEach((industry, industryIndex) => {
              const marketWeight = MICE_MARKET_WEIGHTS[market];
              const industryWeight = MICE_INDUSTRY_WEIGHTS[industry];
              const countryWeight = MICE_COUNTRY_WEIGHTS[countryItem.country];
              const timeWeight = 1 + yearIndex * 0.12 + quarterIndex * 0.08 + (yearMode === 'fiscal' ? 0.05 : 0);
              const baseWeight = marketWeight * industryWeight * countryWeight * timeWeight * (yearlyTrend[year] || 1);
              const sequenceWeight = 1 + countryIndex * 0.015 + industryIndex * 0.02;

              const miceEvents = Math.round((520 + quarterIndex * 72 + yearIndex * 95) * baseWeight * sequenceWeight);
              const miceVisitors = Math.round(miceEvents * (market === 'International' ? 12.8 : 8.2));
              const revenueGenerated = Math.round(miceEvents * (market === 'International' ? 4200 : 2900));
              const avgStayDays = Number((market === 'International' ? 4.4 : 2.9) + quarterIndex * 0.18 + yearIndex * 0.11 + (countryIndex % 3) * 0.05).toFixed(1);
              const avgSpendPerTrip = Number(
                (market === 'International' ? 17500 : 11800) + quarterIndex * 780 + yearIndex * 640 + industryIndex * 420 + countryIndex * 95
              );
              const avgSpendPerDay = Number((avgSpendPerTrip / Number(avgStayDays)).toFixed(0));

              records.push({
                yearMode,
                year,
                quarter: quarterIndex + 1,
                quarterLabel,
                market,
                industry,
                country: countryItem.country,
                nationality: countryItem.country,
                continent: countryItem.continent,
                miceEvents,
                revenueGenerated,
                miceVisitors,
                avgStayDays: Number(avgStayDays),
                avgSpendPerTrip,
                avgSpendPerDay
              });
            });
          });
        });
      });
    });
  });

  return records;
};

const makeSeries = (values) =>
  values.map((value, index) => ({
    year: 2007 + index,
    value
  }));

const _SP_REV = [52699, 58398, 53226, 69552, 81636, 89460, 81721, 103149, 96910, 117320, 129860, 97020, 12000, 0, 145000, 54000, 95000, 48000];
const _SP_WEIGHTS = {
  Meetings:    [0.26, 0.26, 0.26, 0.26, 0.26, 0.27, 0.26, 0.27, 0.26, 0.26, 0.25, 0.25, 0.30, 0.30, 0.25, 0.25, 0.25, 0.25],
  Incentives:  [0.30, 0.30, 0.29, 0.28, 0.29, 0.29, 0.30, 0.30, 0.30, 0.29, 0.29, 0.29, 0.32, 0.30, 0.29, 0.29, 0.29, 0.29],
  Conventions: [0.13, 0.13, 0.13, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.12, 0.14, 0.14, 0.12, 0.11, 0.11, 0.11],
  Exhibitions: [0.31, 0.31, 0.32, 0.32, 0.31, 0.30, 0.30, 0.29, 0.30, 0.31, 0.32, 0.32, 0.24, 0.24, 0.34, 0.35, 0.35, 0.34],
  'Mega Events':[0.00, 0.00, 0.00, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.02, 0.00, 0.02, 0.00, 0.00, 0.00, 0.01],
};
function createStatPerfHistorical() {
  const result = [];
  _SP_REV.forEach((total, i) => {
    Object.entries(_SP_WEIGHTS).forEach(([sec, w]) => {
      result.push({ year: 2008 + i, sector_name: sec, revenue_generated: Math.round(total * w[i]) });
    });
  });
  return result;
}

const MICE_FIXED_PROFILE = {
  charts: {
    events: makeSeries([
      6242, 6155, 6163, 6352, 6803, 7445, 7915, 7465, 7634, 7682,
      8120, 8450, 7890, 1700, 0, 6320, 2030, 2860, 1910, 1000
    ]),
    revenue: makeSeries([
      69517, 52699, 58398, 53226, 69552, 81636, 89460, 81721, 103149, 96910,
      117320, 129860, 97020, 12000, 0, 145000, 54000, 95000, 48000, 30000
    ]),
    visitors: makeSeries([
      857244, 727723, 730352, 696908, 799450, 916036, 1066963, 1156274, 1460528, 1442481,
      1630000, 1805000, 1742000, 438000, 0, 2200000, 880000, 1700000, 860000, 500000
    ])
  },
  kpis: {
    events: 17753,
    eventsGrowth: 6.6,
    visitors: 560512,
    visitorsGrowth: -31.3,
    topNationality: 'China',
    topNationalityGrowth: 32.2,
    topIndustry: 'Meetings'
  },
  nationalityPerformance: [
    { continent: 'Asia', nationality: 'China', current: 204280, previous: 154479, yoy: 32.2 },
    { continent: 'Asia', nationality: 'India', current: 169804, previous: 203690, yoy: -16.6 },
    { continent: 'Asia', nationality: 'Malaysia', current: 57337, previous: 112668, yoy: -49.1 },
    { continent: 'Asia', nationality: 'Hong Kong', current: 19070, previous: 17290, yoy: 10.3 },
    { continent: 'Europe', nationality: 'Germany', current: 13332, previous: 17584, yoy: -24.2 },
    { continent: 'Asia', nationality: 'Singapore', current: 10879, previous: 31902, yoy: -65.9 },
    { continent: 'North America', nationality: 'United States of America', current: 9299, previous: 38809, yoy: -76.0 },
    { continent: 'Asia', nationality: 'Vietnam', current: 8529, previous: 30834, yoy: -72.3 },
    { continent: 'Asia', nationality: 'Philippines', current: 8237, previous: 7586, yoy: 8.6 },
    { continent: 'Asia', nationality: 'Korea, South', current: 6143, previous: 24799, yoy: -75.2 },
    { continent: 'Asia', nationality: 'Japan', current: 5747, previous: 14659, yoy: -60.8 },
    { continent: 'Asia', nationality: 'Indonesia', current: 5441, previous: 24823, yoy: -78.1 },
    { continent: 'Oceania', nationality: 'Australia', current: 5315, previous: 15344, yoy: -65.4 },
    { continent: 'Europe', nationality: 'United Kingdom', current: 4838, previous: 20153, yoy: -76.0 },
    { continent: 'Europe', nationality: 'France', current: 3985, previous: 9577, yoy: -58.4 },
    { continent: 'Europe', nationality: 'Belgium', current: 3513, previous: 1881, yoy: 86.8 },
    { continent: 'Europe', nationality: 'Austria', current: 3211, previous: 1584, yoy: 102.7 },
    { continent: 'Europe', nationality: 'Italy', current: 3124, previous: 4847, yoy: -35.5 },
    { continent: 'Asia', nationality: 'Bangladesh', current: 3043, previous: 975, yoy: 212.1 }
  ],
  nationalityIndustryMatrix: [
    { nationality: 'China', Meetings: 107528, Incentives: 96752, Conventions: 0, Exhibitions: 0, Total: 204280 },
    { nationality: 'India', Meetings: 93848, Incentives: 75956, Conventions: 0, Exhibitions: 0, Total: 169804 },
    { nationality: 'Malaysia', Meetings: 28343, Incentives: 28994, Conventions: 0, Exhibitions: 0, Total: 57337 },
    { nationality: 'Hong Kong', Meetings: 14677, Incentives: 4393, Conventions: 0, Exhibitions: 0, Total: 19070 },
    { nationality: 'Germany', Meetings: 6511, Incentives: 6821, Conventions: 0, Exhibitions: 0, Total: 13332 },
    { nationality: 'Singapore', Meetings: 5912, Incentives: 4967, Conventions: 0, Exhibitions: 0, Total: 10879 },
    { nationality: 'United States of America', Meetings: 9299, Incentives: 0, Conventions: 0, Exhibitions: 0, Total: 9299 },
    { nationality: 'Vietnam', Meetings: 8529, Incentives: 0, Conventions: 0, Exhibitions: 0, Total: 8529 },
    { nationality: 'Philippines', Meetings: 6278, Incentives: 1959, Conventions: 0, Exhibitions: 0, Total: 8237 },
    { nationality: 'Korea, South', Meetings: 6143, Incentives: 0, Conventions: 0, Exhibitions: 0, Total: 6143 },
    { nationality: 'Japan', Meetings: 4548, Incentives: 1199, Conventions: 0, Exhibitions: 0, Total: 5747 },
    { nationality: 'Indonesia', Meetings: 2210, Incentives: 3231, Conventions: 0, Exhibitions: 0, Total: 5441 },
    { nationality: 'Australia', Meetings: 2489, Incentives: 629, Conventions: 2197, Exhibitions: 0, Total: 5315 },
    { nationality: 'United Kingdom', Meetings: 4838, Incentives: 0, Conventions: 0, Exhibitions: 0, Total: 4838 },
    { nationality: 'France', Meetings: 2963, Incentives: 1022, Conventions: 0, Exhibitions: 0, Total: 3985 },
    { nationality: 'Belgium', Meetings: 0, Incentives: 2269, Conventions: 1244, Exhibitions: 0, Total: 3513 },
    { nationality: 'Austria', Meetings: 0, Incentives: 0, Conventions: 0, Exhibitions: 3211, Total: 3211 }
  ],
  breakdown: {
    total: 560512,
    nationality: [
      { label: 'China', value: 204280 },
      { label: 'India', value: 169804 },
      { label: 'Malaysia', value: 57337 },
      { label: 'Hong Kong', value: 19070 },
      { label: 'Germany', value: 13332 },
      { label: 'Singapore', value: 10879 }
    ],
    industry: [
      { label: 'Meetings', value: 93848 },
      { label: 'Incentives', value: 75956 },
      { label: 'Conventions', value: 3441 },
      { label: 'Exhibitions', value: 7757 }
    ],
    quarter: [
      { label: 'Q1', value: 29799 },
      { label: 'Q4', value: 22918 },
      { label: 'Q2', value: 20627 },
      { label: 'Q3', value: 20504 }
    ]
  },
  nationalityIndustryMatrix2025: [
    { nationality: 'India',                    Meetings: 81238, Conventions: 0,  Total: 81238 },
    { nationality: 'China',                    Meetings: 60881, Conventions: 0,  Total: 60881 },
    { nationality: 'Hong Kong',                Meetings: 15680, Conventions: 0,  Total: 15680 },
    { nationality: 'Malaysia',                 Meetings: 13598, Conventions: 0,  Total: 13598 },
    { nationality: 'Vietnam',                  Meetings: 6190,  Conventions: 0,  Total: 6190  },
    { nationality: 'Germany',                  Meetings: 4750,  Conventions: 0,  Total: 4750  },
    { nationality: 'Australia',                Meetings: 3611,  Conventions: 0,  Total: 3611  },
    { nationality: 'United States of America', Meetings: 3479,  Conventions: 10, Total: 3489  },
    { nationality: 'United Kingdom',           Meetings: 3483,  Conventions: 0,  Total: 3483  },
    { nationality: 'France',                   Meetings: 2293,  Conventions: 0,  Total: 2293  },
    { nationality: 'Japan',                    Meetings: 2195,  Conventions: 0,  Total: 2195  },
    { nationality: 'Taiwan',                   Meetings: 1050,  Conventions: 0,  Total: 1050  },
    { nationality: 'Norway',                   Meetings: 794,   Conventions: 0,  Total: 794   },
    { nationality: 'Myanmar',                  Meetings: 779,   Conventions: 0,  Total: 779   },
    { nationality: 'Indonesia',                Meetings: 559,   Conventions: 0,  Total: 559   },
    { nationality: 'Laos',                     Meetings: 472,   Conventions: 0,  Total: 472   },
    { nationality: 'Israel',                   Meetings: 417,   Conventions: 0,  Total: 417   }
  ],
  nationalityQuarterMatrix: [
    { nationality: 'India',                    Q1: 28672, Q2: 27040, Q3: 25526, Q4: 0,     Total: 81238 },
    { nationality: 'China',                    Q1: 18442, Q2: 16200, Q3: 14960, Q4: 11279, Total: 60881 },
    { nationality: 'Hong Kong',                Q1: 4200,  Q2: 3840,  Q3: 3980,  Q4: 3660,  Total: 15680 },
    { nationality: 'Malaysia',                 Q1: 3800,  Q2: 3498,  Q3: 3500,  Q4: 2800,  Total: 13598 },
    { nationality: 'Vietnam',                  Q1: 1800,  Q2: 1590,  Q3: 1700,  Q4: 1100,  Total: 6190  },
    { nationality: 'Germany',                  Q1: 1400,  Q2: 1250,  Q3: 1100,  Q4: 1000,  Total: 4750  },
    { nationality: 'Australia',                Q1: 1050,  Q2: 960,   Q3: 890,   Q4: 711,   Total: 3611  },
    { nationality: 'United States of America', Q1: 950,   Q2: 890,   Q3: 870,   Q4: 779,   Total: 3489  },
    { nationality: 'United Kingdom',           Q1: 910,   Q2: 870,   Q3: 850,   Q4: 853,   Total: 3483  },
    { nationality: 'France',                   Q1: 620,   Q2: 590,   Q3: 570,   Q4: 513,   Total: 2293  },
    { nationality: 'Japan',                    Q1: 610,   Q2: 580,   Q3: 560,   Q4: 445,   Total: 2195  },
    { nationality: 'Taiwan',                   Q1: 290,   Q2: 270,   Q3: 260,   Q4: 230,   Total: 1050  },
    { nationality: 'Norway',                   Q1: 210,   Q2: 200,   Q3: 195,   Q4: 189,   Total: 794   },
    { nationality: 'Myanmar',                  Q1: 210,   Q2: 197,   Q3: 190,   Q4: 182,   Total: 779   },
    { nationality: 'Indonesia',                Q1: 150,   Q2: 143,   Q3: 140,   Q4: 126,   Total: 559   },
    { nationality: 'Laos',                     Q1: 130,   Q2: 122,   Q3: 120,   Q4: 100,   Total: 472   },
    { nationality: 'Israel',                   Q1: 115,   Q2: 108,   Q3: 105,   Q4: 89,    Total: 417   }
  ],
  sankeyFlow: {
    total: 201479,
    nationality: [
      { label: 'India',                    value: 81238,
        industry: [{ label: 'Meetings', value: 81238, quarter: [{ label: 'Q1', value: 28672 }, { label: 'Q2', value: 27040 }, { label: 'Q3', value: 25526 }] }] },
      { label: 'China',                    value: 60881,
        industry: [{ label: 'Meetings', value: 55000, quarter: [{ label: 'Q1', value: 15500 }, { label: 'Q2', value: 14300 }, { label: 'Q3', value: 14000 }, { label: 'Q4', value: 11200 }] },
                   { label: 'Incentives', value: 5881, quarter: [{ label: 'Q1', value: 1700 }, { label: 'Q2', value: 1600 }, { label: 'Q3', value: 1500 }, { label: 'Q4', value: 1081 }] }] },
      { label: 'Hong Kong',                value: 15680,
        industry: [{ label: 'Meetings', value: 14677, quarter: [{ label: 'Q1', value: 4000 }, { label: 'Q2', value: 3800 }, { label: 'Q3', value: 3900 }, { label: 'Q4', value: 2977 }] },
                   { label: 'Incentives', value: 1003, quarter: [{ label: 'Q1', value: 280 }, { label: 'Q2', value: 250 }, { label: 'Q3', value: 250 }, { label: 'Q4', value: 223 }] }] },
      { label: 'Malaysia',                 value: 13598,
        industry: [{ label: 'Meetings', value: 7000, quarter: [{ label: 'Q1', value: 1900 }, { label: 'Q2', value: 1850 }, { label: 'Q3', value: 1750 }, { label: 'Q4', value: 1500 }] },
                   { label: 'Incentives', value: 6598, quarter: [{ label: 'Q1', value: 1800 }, { label: 'Q2', value: 1748 }, { label: 'Q3', value: 1750 }, { label: 'Q4', value: 1300 }] }] },
      { label: 'Vietnam',                  value: 6190,
        industry: [{ label: 'Meetings', value: 6190, quarter: [{ label: 'Q1', value: 1800 }, { label: 'Q2', value: 1590 }, { label: 'Q3', value: 1700 }, { label: 'Q4', value: 1100 }] }] },
      { label: 'Germany',                  value: 4750,
        industry: [{ label: 'Meetings', value: 2500, quarter: [{ label: 'Q1', value: 700 }, { label: 'Q2', value: 650 }, { label: 'Q3', value: 600 }, { label: 'Q4', value: 550 }] },
                   { label: 'Incentives', value: 2250, quarter: [{ label: 'Q1', value: 620 }, { label: 'Q2', value: 600 }, { label: 'Q3', value: 560 }, { label: 'Q4', value: 470 }] }] },
      { label: 'Australia',                value: 3611,
        industry: [{ label: 'Meetings', value: 2489, quarter: [{ label: 'Q1', value: 700 }, { label: 'Q2', value: 650 }, { label: 'Q3', value: 620 }, { label: 'Q4', value: 519 }] },
                   { label: 'Incentives', value: 629, quarter: [{ label: 'Q1', value: 180 }, { label: 'Q2', value: 165 }, { label: 'Q3', value: 160 }, { label: 'Q4', value: 124 }] },
                   { label: 'Conventions', value: 493, quarter: [{ label: 'Q1', value: 140 }, { label: 'Q2', value: 130 }, { label: 'Q3', value: 130 }, { label: 'Q4', value: 93 }] }] },
      { label: 'United Kingdom',           value: 3483,
        industry: [{ label: 'Meetings', value: 3483, quarter: [{ label: 'Q1', value: 910 }, { label: 'Q2', value: 870 }, { label: 'Q3', value: 850 }, { label: 'Q4', value: 853 }] }] }
    ]
  },
  chartsQuarterly: {
    events: [
      { quarter: 'Q1', thisYear: 4500, lastYear: 1494 },
      { quarter: 'Q2', thisYear: 4200, lastYear: 5024 },
      { quarter: 'Q3', thisYear: 4550, lastYear: 5254 },
      { quarter: 'Q4', thisYear: 4800, lastYear: 5150 }
    ],
    visitors: [
      { quarter: 'Q1', thisYear: 200000, lastYear: 146199 },
      { quarter: 'Q2', thisYear: 152000, lastYear: 202937 },
      { quarter: 'Q3', thisYear: 148000, lastYear: 216691 },
      { quarter: 'Q4', thisYear: 60000, lastYear: 234375 }
    ]
  },
  statPerfKpi: {
    visitors:          1111856,
    visitorsLy:        1701234,
    yoyVisitors:       -34.6,
    revenue:           64833.17,
    revenueLy:         94750,
    yoyRevenue:        -31.6,
    events:            2443,
    eventsLy:          2823,
    yoyEvents:         -13.5,
    revenuePerEvent:   26538342.57,
    revenuePerVisitor: 58310.76,
    visitorsPerEvent:  455.12,
  },
  statPerfSector: [
    { sector_name: 'Meetings',     no_of_visitors: 279575,  revenue_generated: 16115, no_of_events: 832 },
    { sector_name: 'Incentives',   no_of_visitors: 329961,  revenue_generated: 19052, no_of_events: 813 },
    { sector_name: 'Conventions',  no_of_visitors: 142189,  revenue_generated:  7419, no_of_events: 660 },
    { sector_name: 'Exhibitions',  no_of_visitors: 360131,  revenue_generated: 22247, no_of_events: 138 },
  ],
  statPerfHistorical: createStatPerfHistorical(),
  statPerfFyKpi: {
    stayingPeriod:   5.55,  stayingPeriodLy:   5.21,  yoyStaying:    6.5,
    spendingPerDay:  10321.39, spendingPerDayLy: 9870.00, yoySpendDay: 4.6,
    spendingPerTrip: 57166.10, spendingPerTripLy: 51380.00, yoySpendTrip: 11.3,
  },
  statPerfFySector: [
    { sector_name: 'Meetings',    staying_period: 4.20, spending_per_head_per_day:  9800, spending_per_head_per_trip: 41160 },
    { sector_name: 'Incentives',  staying_period: 6.50, spending_per_head_per_day: 12500, spending_per_head_per_trip: 81250 },
    { sector_name: 'Conventions', staying_period: 5.80, spending_per_head_per_day: 10100, spending_per_head_per_trip: 58580 },
    { sector_name: 'Exhibitions', staying_period: 3.90, spending_per_head_per_day:  8600, spending_per_head_per_trip: 33540 },
    { sector_name: 'Mega Events', staying_period: 2.50, spending_per_head_per_day:  7200, spending_per_head_per_trip: 18000 },
  ],
};

export const FALLBACK_COUNTRIES = [
  // Asia
  { countryCode: 'TH', countryName: 'Thailand',             continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'CN', countryName: 'China',                continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'JP', countryName: 'Japan',                continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'SG', countryName: 'Singapore',            continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'MY', countryName: 'Malaysia',             continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'IN', countryName: 'India',                continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'KR', countryName: 'Korea, South',         continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'ID', countryName: 'Indonesia',            continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'PH', countryName: 'Philippines',          continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'VN', countryName: 'Vietnam',              continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'HK', countryName: 'Hong Kong',            continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'TW', countryName: 'Taiwan',               continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'BD', countryName: 'Bangladesh',           continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'PK', countryName: 'Pakistan',             continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'LK', countryName: 'Sri Lanka',            continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'AE', countryName: 'United Arab Emirates', continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'SA', countryName: 'Saudi Arabia',         continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'IL', countryName: 'Israel',               continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'MM', countryName: 'Myanmar',              continentCode: 'AS', continentName: 'Asia' },
  { countryCode: 'KH', countryName: 'Cambodia',             continentCode: 'AS', continentName: 'Asia' },
  // Europe
  { countryCode: 'DE', countryName: 'Germany',              continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'GB', countryName: 'United Kingdom',       continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'FR', countryName: 'France',               continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'IT', countryName: 'Italy',                continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'ES', countryName: 'Spain',                continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'NL', countryName: 'Netherlands',          continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'SE', countryName: 'Sweden',               continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'CH', countryName: 'Switzerland',          continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'BE', countryName: 'Belgium',              continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'AT', countryName: 'Austria',              continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'PL', countryName: 'Poland',               continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'CZ', countryName: 'Czech Republic',       continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'DK', countryName: 'Denmark',              continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'NO', countryName: 'Norway',               continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'FI', countryName: 'Finland',              continentCode: 'EU', continentName: 'Europe' },
  { countryCode: 'RU', countryName: 'Russia',               continentCode: 'EU', continentName: 'Europe' },
  // North America
  { countryCode: 'US', countryName: 'United States of America', continentCode: 'NA', continentName: 'North America' },
  { countryCode: 'CA', countryName: 'Canada',               continentCode: 'NA', continentName: 'North America' },
  { countryCode: 'MX', countryName: 'Mexico',               continentCode: 'NA', continentName: 'North America' },
  // South America
  { countryCode: 'BR', countryName: 'Brazil',               continentCode: 'SA', continentName: 'South America' },
  { countryCode: 'AR', countryName: 'Argentina',            continentCode: 'SA', continentName: 'South America' },
  { countryCode: 'CL', countryName: 'Chile',                continentCode: 'SA', continentName: 'South America' },
  { countryCode: 'CO', countryName: 'Colombia',             continentCode: 'SA', continentName: 'South America' },
  // Oceania
  { countryCode: 'AU', countryName: 'Australia',            continentCode: 'OC', continentName: 'Oceania' },
  { countryCode: 'NZ', countryName: 'New Zealand',          continentCode: 'OC', continentName: 'Oceania' },
  // Africa
  { countryCode: 'ZA', countryName: 'South Africa',         continentCode: 'AF', continentName: 'Africa' },
  { countryCode: 'NG', countryName: 'Nigeria',              continentCode: 'AF', continentName: 'Africa' },
  { countryCode: 'EG', countryName: 'Egypt',                continentCode: 'AF', continentName: 'Africa' },
  { countryCode: 'KE', countryName: 'Kenya',                continentCode: 'AF', continentName: 'Africa' },
];

/**
 * Build live datasets from API-fetched fixedProfile.
 * Each dataset returns flat `records` ที่ configurable widgets (Chart, Bar, Pie, Table, …)
 * map fields ผ่าน widget.mapping ได้
 */
export const buildLiveDatasets = (fixedProfile) => {
  if (!fixedProfile) return {};
  const out = {};

  // 1) Annual trend — events + revenue + visitors + staying + spending per year
  const events = fixedProfile.charts?.events || [];
  const revenue = fixedProfile.charts?.revenue || [];
  const visitors = fixedProfile.charts?.visitors || [];
  const stay = fixedProfile.charts?.stayingPeriod || [];
  const spendDay = fixedProfile.charts?.spendingPerDay || [];
  const spendTrip = fixedProfile.charts?.spendingPerTrip || [];
  const years = Array.from(new Set([
    ...events.map(r => r.year), ...revenue.map(r => r.year), ...visitors.map(r => r.year),
  ])).sort((a, b) => a - b);
  if (years.length) {
    const byYear = (arr, y) => arr.find(r => r.year === y);
    out.miceAnnualLive = {
      id: 'miceAnnualLive',
      label: 'MICE Annual (Live)',
      description: 'แนวโน้มรายปี — events / revenue / visitors / staying / spending (ดึงจาก API ตาม filter ปัจจุบัน)',
      fields: [
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'events', label: 'No. of Events', type: 'number' },
        { key: 'revenue', label: 'Revenue (M Baht)', type: 'number' },
        { key: 'visitors', label: 'No. of Visitors', type: 'number' },
        { key: 'stayingPeriod', label: 'Avg Staying (days)', type: 'number' },
        { key: 'spendingPerDay', label: 'Spending per Day', type: 'number' },
        { key: 'spendingPerTrip', label: 'Spending per Trip', type: 'number' },
      ],
      records: years.map((y) => ({
        year: y,
        events:        byYear(events, y)?.value ?? 0,
        revenue:       byYear(revenue, y)?.value ?? 0,
        visitors:      byYear(visitors, y)?.value ?? 0,
        stayingPeriod: byYear(stay, y)?.value ?? 0,
        spendingPerDay: byYear(spendDay, y)?.value ?? 0,
        spendingPerTrip: byYear(spendTrip, y)?.value ?? 0,
      })),
    };
  }

  // 2) Nationality performance — country breakdown with YoY
  const nat = fixedProfile.nationalityPerformance || [];
  if (nat.length) {
    out.miceNationalityLive = {
      id: 'miceNationalityLive',
      label: 'MICE Nationality (Live)',
      description: 'ผลงานรายสัญชาติ — visitors ปีนี้/ปีที่แล้ว + %YoY (ดึงจาก API ตาม filter ปัจจุบัน)',
      fields: [
        { key: 'continent', label: 'Continent', type: 'category' },
        { key: 'nationality', label: 'Nationality', type: 'category' },
        { key: 'current', label: 'Visitors (Current)', type: 'number' },
        { key: 'previous', label: 'Visitors (Last Year)', type: 'number' },
        { key: 'yoy', label: '%YoY', type: 'number' },
      ],
      records: nat.map(r => ({
        continent: r.continent || '',
        nationality: r.nationality || '',
        current: Number(r.current || 0),
        previous: Number(r.previous || 0),
        yoy: Number(r.yoy || 0),
      })),
    };
  }

  // 3) Quarterly — year + quarter × events/visitors
  const evQ = fixedProfile.chartsQuarterly?.events || [];
  const viQ = fixedProfile.chartsQuarterly?.visitors || [];
  if (evQ.length || viQ.length) {
    const merged = {};
    [...evQ, ...viQ].forEach(r => {
      const k = `${r.year}-${r.quarter}`;
      if (!merged[k]) merged[k] = { year: r.year, quarter: r.quarter, events: 0, visitors: 0 };
    });
    evQ.forEach(r => { merged[`${r.year}-${r.quarter}`].events = Number(r.value || 0); });
    viQ.forEach(r => { merged[`${r.year}-${r.quarter}`].visitors = Number(r.value || 0); });
    out.miceQuarterlyLive = {
      id: 'miceQuarterlyLive',
      label: 'MICE Quarterly (Live)',
      description: 'รายไตรมาส — events + visitors แยกตามปีและไตรมาส (ดึงจาก API)',
      fields: [
        { key: 'year', label: 'Year', type: 'number' },
        { key: 'quarter', label: 'Quarter', type: 'category' },
        { key: 'events', label: 'No. of Events', type: 'number' },
        { key: 'visitors', label: 'No. of Visitors', type: 'number' },
      ],
      records: Object.values(merged),
    };
  }

  // 4) KPI summary — single row aggregate (matches PBI top cards)
  const kpis = fixedProfile.kpis;
  if (kpis) {
    out.miceKpiLive = {
      id: 'miceKpiLive',
      label: 'MICE KPI (Live)',
      description: 'สรุป KPI หลัก — MICE Inter Visitors / %YoY / Top Nationality / Top Industry / Events / %YoY (ดึงจาก API)',
      fields: [
        { key: 'events',                label: 'MICE Events',         type: 'number' },
        { key: 'eventsGrowth',          label: 'Events %YoY',         type: 'number' },
        { key: 'visitors',              label: 'MICE Inter Visitors', type: 'number' },
        { key: 'visitorsGrowth',        label: 'Visitors %YoY',       type: 'number' },
        { key: 'topNationality',        label: 'Top Nationality',     type: 'category' },
        { key: 'topNationalityGrowth',  label: 'Top Nat %YoY',        type: 'number' },
        { key: 'topIndustry',           label: 'Top Industry',        type: 'category' },
      ],
      records: [{
        events:               Number(kpis.events || 0),
        eventsGrowth:         Number(kpis.eventsGrowth || 0),
        visitors:             Number(kpis.visitors || 0),
        visitorsGrowth:       Number(kpis.visitorsGrowth || 0),
        topNationality:       String(kpis.topNationality || '-'),
        topNationalityGrowth: Number(kpis.topNationalityGrowth || 0),
        topIndustry:          String(kpis.topIndustry || '-'),
      }],
    };
  }

  // 5) Quarterly detail — same Q1-Q4 view used by PBI quarterly charts (events + visitors + YoY)
  const evQDetail = fixedProfile.chartsQuarterly?.events || [];
  const viQDetail = fixedProfile.chartsQuarterly?.visitors || [];
  if (evQDetail.length || viQDetail.length) {
    const merged = {};
    [...evQDetail, ...viQDetail].forEach(r => {
      const k = r.quarter;
      if (!merged[k]) merged[k] = {
        quarter: k,
        eventsThis: 0, eventsLast: 0, eventsYoy: 0,
        visitorsThis: 0, visitorsLast: 0, visitorsYoy: 0,
      };
    });
    evQDetail.forEach(r => {
      merged[r.quarter].eventsThis = Number(r.thisYear || 0);
      merged[r.quarter].eventsLast = Number(r.lastYear || 0);
      merged[r.quarter].eventsYoy  = Number(r.yoy || 0);
    });
    viQDetail.forEach(r => {
      merged[r.quarter].visitorsThis = Number(r.thisYear || 0);
      merged[r.quarter].visitorsLast = Number(r.lastYear || 0);
      merged[r.quarter].visitorsYoy  = Number(r.yoy || 0);
    });
    out.miceQuarterlyDetailLive = {
      id: 'miceQuarterlyDetailLive',
      label: 'MICE Quarterly Detail (Live)',
      description: 'รายไตรมาส — events + visitors (This Year / Last Year / %YoY) แบบเดียวกับกราฟ PBI',
      fields: [
        { key: 'quarter',       label: 'Quarter',                type: 'category' },
        { key: 'eventsThis',    label: 'Events (This Year)',     type: 'number' },
        { key: 'eventsLast',    label: 'Events (Last Year)',     type: 'number' },
        { key: 'eventsYoy',     label: 'Events %YoY',            type: 'number' },
        { key: 'visitorsThis',  label: 'Visitors (This Year)',   type: 'number' },
        { key: 'visitorsLast',  label: 'Visitors (Last Year)',   type: 'number' },
        { key: 'visitorsYoy',   label: 'Visitors %YoY',          type: 'number' },
      ],
      records: Object.values(merged),
    };
  }

  // 6) Drill flow — flat nationality × industry × quarter rows (Visitors Breakdown sankey)
  const flow = fixedProfile.sankeyFlow;
  if (flow?.nationality?.length) {
    const records = [];
    flow.nationality.forEach((nat) => {
      (nat.industry || []).forEach((ind) => {
        (ind.quarter || []).forEach((q) => {
          records.push({
            nationality: nat.label,
            industry:    ind.label,
            quarter:     q.label,
            visitors:    Number(q.value || 0),
          });
        });
      });
    });
    if (records.length) {
      out.miceDrillFlowLive = {
        id: 'miceDrillFlowLive',
        label: 'MICE Drill Flow (Live)',
        description: 'รายละเอียดผู้เดินทาง MICE แยกตามสัญชาติ × อุตสาหกรรม × ไตรมาส (Visitors Breakdown)',
        fields: [
          { key: 'nationality', label: 'Nationality', type: 'category' },
          { key: 'industry',    label: 'Industry',    type: 'category' },
          { key: 'quarter',     label: 'Quarter',     type: 'category' },
          { key: 'visitors',    label: 'Visitors',    type: 'number' },
        ],
        records,
      };
    }
  }

  return out;
};

export const datasetLibrary = {
  miceStatistics: {
    id: 'miceStatistics',
    label: 'MICE Statistics',
    description: 'ชุดข้อมูลตัวอย่างสำหรับแนวโน้มงานไมซ์ รายได้ นักเดินทาง และตัวกรองปี/อุตสาหกรรม/ประเทศ',
    fields: [
      { key: 'yearMode', label: 'Year Mode', type: 'category' },
      { key: 'year', label: 'Year', type: 'number' },
      { key: 'quarter', label: 'Quarter', type: 'number' },
      { key: 'quarterLabel', label: 'Quarter Label', type: 'category' },
      { key: 'market', label: 'Market', type: 'category' },
      { key: 'industry', label: 'Industry', type: 'category' },
      { key: 'country', label: 'Country', type: 'category' },
      { key: 'nationality', label: 'Nationality', type: 'category' },
      { key: 'continent', label: 'Continent', type: 'category' },
      { key: 'miceEvents', label: 'MICE Events', type: 'number' },
      { key: 'revenueGenerated', label: 'Revenue Generated', type: 'number' },
      { key: 'miceVisitors', label: 'MICE Visitors', type: 'number' },
      { key: 'avgStayDays', label: 'Average Length of Stay', type: 'number' },
      { key: 'avgSpendPerTrip', label: 'Average Spend per Trip', type: 'number' },
      { key: 'avgSpendPerDay', label: 'Average Spend per Person per Day', type: 'number' }
    ],
    records: createMiceStatisticsRecords(),
    fixedProfile: MICE_FIXED_PROFILE
  },
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

export const widgetCatalog = [
  {
    type: 'miceStatCard',
    paletteKey: 'miceStatCard:events',
    group: 'ready',
    fixed: true,
    metric: 'events',
    defaultW: 3,
    defaultH: 3,
    label: 'MICE Events (KPI)',
    dataset: 'miceStatistics',
    title: 'MICE Events',
    description: 'จำนวนงาน MICE Events รวม'
  },
  {
    type: 'miceStatCard',
    paletteKey: 'miceStatCard:visitors',
    group: 'ready',
    fixed: true,
    metric: 'visitors',
    defaultW: 3,
    defaultH: 3,
    label: 'MICE Inter Visitors (KPI)',
    dataset: 'miceStatistics',
    title: 'MICE Inter Visitors',
    description: 'จำนวนนักเดินทาง MICE International รวม'
  },
  {
    type: 'miceStatCard',
    paletteKey: 'miceStatCard:topNationality',
    group: 'ready',
    fixed: true,
    metric: 'topNationality',
    defaultW: 3,
    defaultH: 3,
    label: 'Top Nationality (KPI)',
    dataset: 'miceStatistics',
    title: 'Top Nationality',
    description: 'สัญชาตินักเดินทาง MICE สูงสุด'
  },
  {
    type: 'miceStatCard',
    paletteKey: 'miceStatCard:topIndustry',
    group: 'ready',
    fixed: true,
    metric: 'topIndustry',
    defaultW: 3,
    defaultH: 3,
    label: 'Top Industry (KPI)',
    dataset: 'miceStatistics',
    title: 'Top Industry',
    description: 'ประเภทงาน MICE ที่มีนักเดินทางสูงสุด'
  },
  {
    type: 'miceEventsQuarterlyChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 7,
    label: 'MICE Events Performance Over Time',
    dataset: 'miceStatistics',
    title: 'MICE Events Performance Over Time',
    description: 'จำนวนงาน MICE แยกรายไตรมาส เปรียบเทียบ This Year vs Last Year พร้อม %YoY'
  },
  {
    type: 'miceVisitorsQuarterlyChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 7,
    label: 'MICE International Visitors Performance Over Time',
    dataset: 'miceStatistics',
    title: 'MICE International Visitors Performance Over Time',
    description: 'จำนวนนักเดินทาง MICE International แยกรายไตรมาส เปรียบเทียบ This Year vs Last Year พร้อม %YoY'
  },
  {
    type: 'miceEventsChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 6,
    label: 'MICE Events Chart',
    dataset: 'miceStatistics',
    title: 'จำนวนงานไมซ์ที่เกิดขึ้น (MICE Events)',
    description: 'แนวโน้มจำนวนงาน Meetings · Incentives · Conventions · Exhibitions รายปี แยก International/Domestic'
  },
  {
    type: 'miceRevenueChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 6,
    label: 'MICE Revenue Chart',
    dataset: 'miceStatistics',
    title: 'รายได้จากการจัดงานไมซ์ (MICE Revenue Generated)',
    description: 'รายได้รวมจากอุตสาหกรรม MICE ทั้ง 4 ประเภท แสดงแนวโน้มและ %YoY'
  },
  {
    type: 'miceVisitorsChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 6,
    label: 'MICE Visitors Chart',
    dataset: 'miceStatistics',
    title: 'จำนวนนักเดินทางไมซ์ (MICE Visitors)',
    description: 'นักเดินทางที่เข้าร่วมงาน Meetings, Incentive Travel, Conventions & Exhibitions'
  },
  {
    type: 'miceStayingPeriodChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 6,
    label: 'Average Staying Period',
    dataset: 'miceStatistics',
    title: 'จำนวนวันพำนักเฉลี่ย (Average Staying Period)',
    description: 'จำนวนวันพำนักเฉลี่ยต่อทริปของผู้เดินทาง MICE รายปี (Fiscal Year)'
  },
  {
    type: 'miceSpendingPerDayChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 6,
    label: 'Spending per Head per Day',
    dataset: 'miceStatistics',
    title: 'ค่าใช้จ่ายเฉลี่ยต่อคนต่อวัน (Spending per Head per Day)',
    description: 'ค่าใช้จ่ายเฉลี่ยต่อหัวต่อวันของผู้เดินทาง MICE (บาท/คน/วัน) — Fiscal Year'
  },
  {
    type: 'miceSpendingPerTripChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 6,
    label: 'Spending per Head per Trip',
    dataset: 'miceStatistics',
    title: 'ค่าใช้จ่ายเฉลี่ยต่อคนต่อทริป (Spending per Head per Trip)',
    description: 'ค่าใช้จ่ายเฉลี่ยต่อหัวต่อทริปของผู้เดินทาง MICE (บาท/คน/ทริป) — Fiscal Year'
  },
  {
    type: 'miceNationalityPerformance',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 8,
    label: 'Nationality Performance',
    dataset: 'miceStatistics',
    title: 'Nationality Performance',
    description: 'จำนวน MICE Visitors แยกสัญชาติ เปรียบเทียบปีปัจจุบันกับปีก่อน'
  },
  {
    type: 'miceNationalityIndustryMatrix',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 8,
    label: 'Industry Matrix',
    dataset: 'miceStatistics',
    title: 'Nationality by MICE Industry',
    description: 'Visitors แยกตาม Nationality × ประเภทงาน Meetings · Incentives · Conventions · Exhibitions'
  },
  {
    type: 'miceNationalityMatrixView',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 9,
    label: 'Nationality Matrix (Industry / Period)',
    dataset: 'miceStatistics',
    title: 'Nationality by MICE Industry',
    description: 'ตารางสัญชาติ × ประเภทงาน หรือ × ไตรมาส สลับมุมมองได้'
  },
  {
    type: 'miceDrillFlow',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 12,
    label: 'MICE Visitors Breakdown',
    dataset: 'miceStatistics',
    title: 'MICE Visitors Breakdown',
    description: 'Breakdown นักเดินทาง MICE แยก Nationality → Industry → Quarter'
  },
  {
    type: 'miceDataTable',
    group: 'ready',
    fixed: true,
    defaultW: 8,
    defaultH: 10,
    label: 'MICE Statistics Table',
    dataset: 'miceStatistics',
    title: 'MICE Statistics',
    description: 'ตารางสถิติ MICE รายปี: Events, Visitors, Revenue แยกตาม Quarter'
  },
  // ── MICE Statistics Performance ─────────────────────────────────────────────
  {
    type: 'miceStatPerfKpiCard',
    paletteKey: 'miceStatPerfKpiCard:visitors',
    group: 'ready',
    fixed: true,
    metric: 'visitors',
    defaultW: 4,
    defaultH: 3,
    label: 'Stat Perf — จำนวนนักเดินทางไมซ์ (KPI)',
    dataset: 'miceStatistics',
    title: 'จำนวนนักเดินทางไมซ์',
    description: 'จำนวนนักเดินทางไมซ์รวม พร้อม %YoY'
  },
  {
    type: 'miceStatPerfKpiCard',
    paletteKey: 'miceStatPerfKpiCard:revenue',
    group: 'ready',
    fixed: true,
    metric: 'revenue',
    defaultW: 4,
    defaultH: 3,
    label: 'Stat Perf — รายได้จากการจัดงาน (KPI)',
    dataset: 'miceStatistics',
    title: 'รายได้จากการจัดงาน (ล้านบาท)',
    description: 'รายได้รวมจากการจัดงาน MICE พร้อม %YoY'
  },
  {
    type: 'miceStatPerfKpiCard',
    paletteKey: 'miceStatPerfKpiCard:events',
    group: 'ready',
    fixed: true,
    metric: 'events',
    defaultW: 4,
    defaultH: 3,
    label: 'Stat Perf — จำนวนงานไมซ์ (KPI)',
    dataset: 'miceStatistics',
    title: 'จำนวนงานไมซ์',
    description: 'จำนวนงาน MICE รวม พร้อม %YoY'
  },
  {
    type: 'miceStatPerfKpiCard',
    paletteKey: 'miceStatPerfKpiCard:revenuePerEvent',
    group: 'ready',
    fixed: true,
    metric: 'revenuePerEvent',
    defaultW: 4,
    defaultH: 3,
    label: 'Stat Perf — รายได้เฉลี่ยต่อ 1 งาน (KPI)',
    dataset: 'miceStatistics',
    title: 'รายได้เฉลี่ยต่อ 1 งาน (บาท)',
    description: 'รายได้เฉลี่ยต่องาน MICE'
  },
  {
    type: 'miceStatPerfKpiCard',
    paletteKey: 'miceStatPerfKpiCard:revenuePerVisitor',
    group: 'ready',
    fixed: true,
    metric: 'revenuePerVisitor',
    defaultW: 4,
    defaultH: 3,
    label: 'Stat Perf — รายได้เฉลี่ยต่อ 1 คน (KPI)',
    dataset: 'miceStatistics',
    title: 'รายได้เฉลี่ยต่อ 1 คน (บาท)',
    description: 'รายได้เฉลี่ยต่อนักเดินทาง MICE 1 คน'
  },
  {
    type: 'miceStatPerfKpiCard',
    paletteKey: 'miceStatPerfKpiCard:visitorsPerEvent',
    group: 'ready',
    fixed: true,
    metric: 'visitorsPerEvent',
    defaultW: 4,
    defaultH: 3,
    label: 'Stat Perf — นักเดินทางต่อ 1 งาน (KPI)',
    dataset: 'miceStatistics',
    title: 'นักเดินทางต่อ 1 งาน (คน)',
    description: 'จำนวนนักเดินทางเฉลี่ยต่องาน MICE'
  },
  {
    type: 'miceStatPerfSectorBar',
    paletteKey: 'miceStatPerfSectorBar:visitors',
    group: 'ready',
    fixed: true,
    metric: 'visitors',
    defaultW: 6,
    defaultH: 5,
    label: 'Stat Perf — สัดส่วนนักเดินทางไมซ์',
    dataset: 'miceStatistics',
    title: 'สัดส่วนนักเดินทางไมซ์',
    description: 'แผนภูมิแท่งแนวนอนแสดงสัดส่วนนักเดินทางแยกตามประเภทงาน'
  },
  {
    type: 'miceStatPerfSectorBar',
    paletteKey: 'miceStatPerfSectorBar:revenue',
    group: 'ready',
    fixed: true,
    metric: 'revenue',
    defaultW: 6,
    defaultH: 5,
    label: 'Stat Perf — สัดส่วนรายได้จากการจัดงานไมซ์',
    dataset: 'miceStatistics',
    title: 'สัดส่วนรายได้จากการจัดงานไมซ์',
    description: 'แผนภูมิแท่งแนวนอนแสดงสัดส่วนรายได้แยกตามประเภทงาน'
  },
  {
    type: 'miceStatPerfSectorBar',
    paletteKey: 'miceStatPerfSectorBar:events',
    group: 'ready',
    fixed: true,
    metric: 'events',
    defaultW: 6,
    defaultH: 5,
    label: 'Stat Perf — สัดส่วนจำนวนงานไมซ์',
    dataset: 'miceStatistics',
    title: 'สัดส่วนจำนวนงานไมซ์',
    description: 'แผนภูมิแท่งแนวนอนแสดงสัดส่วนจำนวนงานแยกตามประเภทงาน'
  },
  {
    type: 'miceStatPerfSectorTable',
    group: 'ready',
    fixed: true,
    defaultW: 6,
    defaultH: 6,
    label: 'Stat Perf — ตารางสัดส่วนตามประเภทงาน',
    dataset: 'miceStatistics',
    title: 'สัดส่วนตามประเภทงาน',
    description: 'ตารางแสดง #Visitors, Revenue, #Events แยกตาม Sector พร้อม Total'
  },
  {
    type: 'miceStatPerfHistoricalChart',
    group: 'ready',
    fixed: true,
    defaultW: 12,
    defaultH: 8,
    label: 'Stat Perf — สัดส่วนรายได้รายปีตามอุตสาหกรรม',
    dataset: 'miceStatistics',
    title: 'สัดส่วนรายได้จากการจัดงานไมซ์ตามอุตสาหกรรม',
    description: '100% Stacked Bar แสดงสัดส่วนรายได้ MICE แยกตามประเภทงาน ครอบคลุมปี 2008–2025'
  },
  {
    type: 'miceStatPerfFyKpiCard',
    group: 'ready',
    fixed: true,
    defaultW: 3,
    defaultH: 3,
    label: 'Stat Perf FY — ระยะเวลาอยู่เฉลี่ย (KPI)',
    dataset: 'miceStatistics',
    title: 'ระยะเวลาอยู่เฉลี่ย',
    description: 'KPI สำหรับ Fiscal Year: staying period / spending per day / spending per trip พร้อม YoY',
    metric: 'stayingPeriod',
  },
  {
    type: 'miceStatPerfFyKpiCard',
    group: 'ready',
    fixed: true,
    defaultW: 3,
    defaultH: 3,
    label: 'Stat Perf FY — ค่าใช้จ่ายต่อหัวต่อวัน (KPI)',
    dataset: 'miceStatistics',
    title: 'ค่าใช้จ่ายต่อหัวต่อวัน',
    description: 'KPI Fiscal Year: ค่าใช้จ่ายเฉลี่ยต่อหัวต่อวัน พร้อม YoY',
    metric: 'spendingPerDay',
  },
  {
    type: 'miceStatPerfFyKpiCard',
    group: 'ready',
    fixed: true,
    defaultW: 3,
    defaultH: 3,
    label: 'Stat Perf FY — ค่าใช้จ่ายต่อหัวต่อทริป (KPI)',
    dataset: 'miceStatistics',
    title: 'ค่าใช้จ่ายต่อหัวต่อทริป',
    description: 'KPI Fiscal Year: ค่าใช้จ่ายเฉลี่ยต่อหัวต่อทริป พร้อม YoY',
    metric: 'spendingPerTrip',
  },
  {
    type: 'miceStatPerfFySectorBar',
    group: 'ready',
    fixed: true,
    defaultW: 4,
    defaultH: 6,
    label: 'Stat Perf FY — ระยะเวลาอยู่เฉลี่ยตาม Sector',
    dataset: 'miceStatistics',
    title: 'ระยะเวลาอยู่เฉลี่ยแยกตามอุตสาหกรรม',
    description: 'Bar chart ระยะเวลาอยู่เฉลี่ย (วัน) แยกตาม Sector — Fiscal Year',
    metric: 'stayingPeriod',
  },
  {
    type: 'miceStatPerfFySectorBar',
    group: 'ready',
    fixed: true,
    defaultW: 4,
    defaultH: 6,
    label: 'Stat Perf FY — ค่าใช้จ่ายต่อหัวต่อวันตาม Sector',
    dataset: 'miceStatistics',
    title: 'ค่าใช้จ่ายต่อหัวต่อวันแยกตามอุตสาหกรรม',
    description: 'Bar chart ค่าใช้จ่ายเฉลี่ยต่อหัวต่อวัน แยกตาม Sector — Fiscal Year',
    metric: 'spendingPerDay',
  },
  {
    type: 'miceStatPerfFySectorBar',
    group: 'ready',
    fixed: true,
    defaultW: 4,
    defaultH: 6,
    label: 'Stat Perf FY — ค่าใช้จ่ายต่อหัวต่อทริปตาม Sector',
    dataset: 'miceStatistics',
    title: 'ค่าใช้จ่ายต่อหัวต่อทริปแยกตามอุตสาหกรรม',
    description: 'Bar chart ค่าใช้จ่ายเฉลี่ยต่อหัวต่อทริป แยกตาม Sector — Fiscal Year',
    metric: 'spendingPerTrip',
  },
  {
    type: 'chart',
    group: 'configurable',
    label: 'Chart',
    dataset: 'miceStatistics',
    title: 'MICE Trend',
    description: 'สลับรูปแบบ line, bar, area หรือ stacked bar'
  },
  {
    type: 'kpiCard',
    group: 'configurable',
    label: 'KPI Card',
    dataset: 'miceStatistics',
    title: 'MICE KPI',
    description: 'แสดงตัวเลขสำคัญหรือชื่อประเทศตามสัญชาติ'
  },
  {
    type: 'line',
    group: 'configurable',
    label: 'Line',
    dataset: 'miceStatistics',
    title: 'MICE Trend',
    description: 'แสดงแนวโน้มข้อมูลตามลำดับ'
  },
  {
    type: 'bar',
    group: 'configurable',
    label: 'Bar',
    dataset: 'miceStatistics',
    title: 'MICE Comparison',
    description: 'เปรียบเทียบค่าระหว่างหมวดหมู่'
  },
  {
    type: 'pie',
    group: 'configurable',
    label: 'Pie',
    dataset: 'miceStatistics',
    title: 'MICE Distribution',
    description: 'แสดงสัดส่วนของแต่ละรายการ'
  },
  {
    type: 'treemap',
    group: 'configurable',
    label: 'Treemap',
    dataset: 'miceStatistics',
    title: 'MICE Breakdown',
    description: 'แสดงขนาดข้อมูลแบบจัดกลุ่ม'
  },
  {
    type: 'summaryCard',
    group: 'configurable',
    label: 'Summary Card',
    dataset: 'miceStatistics',
    title: 'MICE Summary',
    description: 'สรุปตัวเลขสำคัญแบบการ์ด'
  },
  {
    type: 'rankingList',
    group: 'configurable',
    label: 'Ranking List',
    dataset: 'miceStatistics',
    title: 'Top MICE',
    description: 'จัดอันดับรายการตามค่า Top N'
  },
  {
    type: 'table',
    group: 'configurable',
    label: 'Table',
    dataset: 'miceStatistics',
    title: 'MICE Records',
    description: 'แสดงข้อมูลเป็นแถวและคอลัมน์'
  },
  { type: 'textbox', group: 'configurable', label: 'TextBox', dataset: '', title: 'Text Box', description: 'แสดงข้อความและ expression' }
];
