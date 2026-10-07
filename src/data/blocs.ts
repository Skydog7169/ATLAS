import type { Bloc, BlocMember } from './types';

const m = (iso: string, note?: string): BlocMember =>
  note ? { iso, status: 'member', note } : { iso, status: 'member' };
const members = (codes: string): BlocMember[] => codes.trim().split(/\s+/).map((iso) => m(iso));

export const BLOCS: Bloc[] = [
  {
    id: 'nato',
    name: 'North Atlantic Treaty Organization',
    shortName: 'NATO',
    category: 'security',
    color: '#4f7cff',
    founded: 1949,
    headquarters: 'Brussels, Belgium',
    description:
      'Collective-defence alliance of 32 North American and European states bound by Article 5. Finland (2023) and Sweden (2024) joined after Russia’s full-scale invasion of Ukraine.',
    members: members(`
      ALB BEL BGR CAN HRV CZE DNK EST FIN FRA DEU GRC HUN ISL ITA LVA LTU LUX
      MNE NLD MKD NOR POL PRT ROU SVK SVN ESP SWE TUR GBR USA
    `),
    sources: [{ name: 'NATO member countries', url: 'https://www.nato.int/cps/en/natohq/topics_52044.htm' }],
    updated: '2026-10',
  },
  {
    id: 'eu',
    name: 'European Union',
    shortName: 'EU',
    category: 'political',
    color: '#2bb3c0',
    founded: 1993,
    headquarters: 'Brussels, Belgium',
    description:
      'Political and economic union of 27 states with a single market, shared external trade policy and, for 20 members, a common currency. The UK left in 2020.',
    members: members(`
      AUT BEL BGR HRV CYP CZE DNK EST FIN FRA DEU GRC HUN IRL ITA LVA LTU LUX
      MLT NLD POL PRT ROU SVK SVN ESP SWE
    `),
    sources: [{ name: 'EU country profiles', url: 'https://european-union.europa.eu/principles-countries-history/eu-countries_en' }],
    updated: '2026-10',
  },
  {
    id: 'brics',
    name: 'BRICS',
    shortName: 'BRICS',
    category: 'economic',
    color: '#f2a23a',
    founded: 2009,
    description:
      'Grouping of large emerging economies that expanded in 2024–2025 to ten full members and a tier of partner countries. Positions itself as a counterweight to Western-led institutions; promotes trade in local currencies and the New Development Bank.',
    members: [
      ...members('BRA RUS IND CHN ZAF'),
      m('EGY', 'Joined January 2024'),
      m('ETH', 'Joined January 2024'),
      m('IRN', 'Joined January 2024'),
      m('ARE', 'Joined January 2024'),
      m('IDN', 'Joined January 2025'),
      { iso: 'SAU', status: 'invited', note: 'Invited in 2023; counted as a member by the 2026 Indian chair but Riyadh has not formally confirmed and attended the New Delhi summit as an invited country' },
      ...'BLR BOL KAZ CUB MYS NGA THA UGA UZB VNM'
        .split(' ')
        .map((iso): BlocMember => ({ iso, status: 'partner', note: 'Partner country since 2025' })),
    ],
    sources: [{ name: 'BRICS Brasil 2025', url: 'https://brics.br/en' }],
    updated: '2026-10',
  },
  {
    id: 'sco',
    name: 'Shanghai Cooperation Organisation',
    shortName: 'SCO',
    category: 'security',
    color: '#c75c9d',
    founded: 2001,
    headquarters: 'Beijing, China',
    description:
      'Eurasian political, economic and security organisation led by China and Russia. Iran joined in 2023 and Belarus in 2024, bringing full membership to ten states.',
    members: [
      ...members('CHN IND IRN KAZ KGZ PAK RUS TJK UZB'),
      m('BLR', 'Joined July 2024'),
      { iso: 'AFG', status: 'observer' },
      { iso: 'MNG', status: 'observer' },
    ],
    sources: [{ name: 'SCO Secretariat', url: 'https://eng.sectsco.org/' }],
    updated: '2026-10',
  },
  {
    id: 'csto',
    name: 'Collective Security Treaty Organization',
    shortName: 'CSTO',
    category: 'security',
    color: '#9b6bff',
    founded: 2002,
    headquarters: 'Moscow, Russia',
    description:
      'Russia-led mutual-defence alliance of post-Soviet states. Armenia froze its participation in 2024 after the alliance declined to intervene over Nagorno-Karabakh.',
    members: [
      ...members('BLR KAZ KGZ RUS TJK'),
      { iso: 'ARM', status: 'frozen', note: 'Participation frozen since February 2024; Yerevan told Moscow in April 2026 it had effectively suspended participation' },
    ],
    sources: [{ name: 'CSTO', url: 'https://en.odkb-csto.org/' }],
    updated: '2026-10',
  },
  {
    id: 'five-eyes',
    name: 'Five Eyes',
    shortName: 'Five Eyes',
    category: 'security',
    color: '#5bd1a3',
    founded: 1946,
    description:
      'Signals-intelligence sharing arrangement rooted in the UKUSA Agreement. The closest intelligence partnership between states.',
    members: members('USA GBR CAN AUS NZL'),
    sources: [{ name: 'GCHQ: UKUSA Agreement', url: 'https://www.gchq.gov.uk/information/ukusa-agreement' }],
    updated: '2026-10',
  },
  {
    id: 'quad',
    name: 'Quadrilateral Security Dialogue',
    shortName: 'Quad',
    category: 'security',
    color: '#3fb0e0',
    founded: 2007,
    description:
      'Strategic dialogue between the United States, Japan, India and Australia focused on a "free and open Indo-Pacific". Revived in 2017 and elevated to leader-level summits in 2021.',
    members: members('USA JPN IND AUS'),
    sources: [{ name: 'US State Department: Quad', url: 'https://www.state.gov/quad/' }],
    updated: '2026-10',
  },
  {
    id: 'aukus',
    name: 'AUKUS',
    shortName: 'AUKUS',
    category: 'security',
    color: '#78c2ff',
    founded: 2021,
    description:
      'Trilateral security pact to supply Australia with nuclear-powered submarines (Pillar I) and to co-develop advanced capabilities such as AI, quantum and hypersonics (Pillar II).',
    members: members('AUS GBR USA'),
    sources: [{ name: 'Australian Department of Defence: AUKUS', url: 'https://www.defence.gov.au/about/taskforces/aukus' }],
    updated: '2026-10',
  },
  {
    id: 'g7',
    name: 'Group of Seven',
    shortName: 'G7',
    category: 'political',
    color: '#ffd166',
    founded: 1975,
    description:
      'Forum of seven large advanced economies that coordinates on the global economy, security and sanctions. The European Union participates as a non-enumerated member.',
    members: members('CAN FRA DEU ITA JPN GBR USA'),
    sources: [{ name: 'G7 Canada 2025', url: 'https://g7.canada.ca/en/' }],
    updated: '2026-10',
  },
  {
    id: 'asean',
    name: 'Association of Southeast Asian Nations',
    shortName: 'ASEAN',
    category: 'regional',
    color: '#ff8c69',
    founded: 1967,
    headquarters: 'Jakarta, Indonesia',
    description:
      'Regional organisation of Southeast Asian states promoting economic integration and non-interference. Timor-Leste was admitted as the 11th member in October 2025.',
    members: [
      ...members('BRN KHM IDN LAO MYS PHL SGP THA VNM'),
      m('MMR', 'Member; limited to non-political representation since the 2021 coup. ASEAN did not endorse the 2025\u201326 junta-run elections'),
      m('TLS', 'Admitted October 2025'),
    ],
    sources: [{ name: 'ASEAN member states', url: 'https://asean.org/member-states/' }],
    updated: '2026-10',
  },
  {
    id: 'au',
    name: 'African Union',
    shortName: 'AU',
    category: 'regional',
    color: '#8bc34a',
    founded: 2002,
    headquarters: 'Addis Ababa, Ethiopia',
    description:
      'Continental union of all 55 African states. Members whose governments took power by coup are suspended from AU activities until constitutional order is restored.',
    members: [
      ...members(`
        DZA AGO BEN BWA BDI CMR CPV CAF TCD COM COD COG CIV DJI EGY GNQ ERI SWZ
        ETH GAB GMB GHA KEN LSO LBR LBY MWI MRT MUS MAR MOZ NAM NGA RWA
        ESH STP SEN SYC SLE SOM ZAF SSD TZA TGO TUN UGA ZMB ZWE
      `),
      m('GIN', 'Suspension after the 2021 coup lifted in January 2026 following elections'),
      { iso: 'MLI', status: 'suspended', note: 'Suspended since 2021 coup' },
      { iso: 'BFA', status: 'suspended', note: 'Suspended since 2022 coup' },
      { iso: 'SDN', status: 'suspended', note: 'Suspended since 2021 coup; reaffirmed February 2026' },
      { iso: 'NER', status: 'suspended', note: 'Suspended since 2023 coup' },
      { iso: 'MDG', status: 'suspended', note: 'Suspended since October 2025 coup' },
      { iso: 'GNB', status: 'suspended', note: 'Suspended since November 2025 coup' },
    ],
    sources: [{ name: 'AU member states', url: 'https://au.int/en/member_states/countryprofiles2' }],
    updated: '2026-10',
  },
  {
    id: 'arab-league',
    name: 'League of Arab States',
    shortName: 'Arab League',
    category: 'regional',
    color: '#d4a373',
    founded: 1945,
    headquarters: 'Cairo, Egypt',
    description:
      'Regional organisation of 22 Arab states. Syria’s membership, suspended in 2011, was restored in 2023.',
    members: members('DZA BHR COM DJI EGY IRQ JOR KWT LBN LBY MRT MAR OMN PSE QAT SAU SOM SDN SYR TUN ARE YEM'),
    sources: [{ name: 'League of Arab States', url: 'https://www.lasportal.org/' }],
    updated: '2026-10',
  },
  {
    id: 'gcc',
    name: 'Gulf Cooperation Council',
    shortName: 'GCC',
    category: 'regional',
    color: '#e0b84c',
    founded: 1981,
    headquarters: 'Riyadh, Saudi Arabia',
    description: 'Political and economic union of the six Arab monarchies of the Persian Gulf, with a joint military command.',
    members: members('BHR KWT OMN QAT SAU ARE'),
    sources: [{ name: 'GCC Secretariat', url: 'https://www.gcc-sg.org/' }],
    updated: '2026-10',
  },
  {
    id: 'mercosur',
    name: 'Southern Common Market',
    shortName: 'Mercosur',
    category: 'economic',
    color: '#4caf8a',
    founded: 1991,
    headquarters: 'Montevideo, Uruguay',
    description:
      'South American trade bloc and customs union. Bolivia became a full member in 2024; Venezuela remains suspended since 2016 despite a 2026 push for readmission. The EU\u2013Mercosur agreement was signed in January 2026 and its trade pillar provisionally applied from May 2026.',
    members: [
      ...members('ARG BRA PRY URY BOL'),
      { iso: 'VEN', status: 'suspended', note: 'Suspended since 2016; readmission proposed by Paraguay and Brazil in 2026 but vetoed by Argentina' },
      ...'CHL COL ECU GUY PER SUR PAN'.split(' ').map((iso): BlocMember => ({ iso, status: 'partner', note: 'Associated state' })),
    ],
    sources: [{ name: 'Mercosur', url: 'https://www.mercosur.int/en/' }],
    updated: '2026-10',
  },
  {
    id: 'opec',
    name: 'Organization of the Petroleum Exporting Countries',
    shortName: 'OPEC',
    category: 'economic',
    color: '#6d6875',
    founded: 1960,
    headquarters: 'Vienna, Austria',
    description:
      'Cartel of 11 oil-exporting states that coordinates production. Angola left in January 2024 and the United Arab Emirates withdrew from OPEC and OPEC+ in May 2026. The wider OPEC+ arrangement adds Russia, Kazakhstan, Mexico and others.',
    members: members('DZA COG GNQ GAB IRN IRQ KWT LBY NGA SAU VEN'),
    sources: [{ name: 'OPEC member countries', url: 'https://www.opec.org/member-countries.html' }],
    updated: '2026-10',
  },
  {
    id: 'ecowas',
    name: 'Economic Community of West African States',
    shortName: 'ECOWAS',
    category: 'regional',
    color: '#a3b18a',
    founded: 1975,
    headquarters: 'Abuja, Nigeria',
    description:
      'West African regional bloc with free movement and a standby force. Mali, Burkina Faso and Niger formally withdrew in January 2025 after forming the Alliance of Sahel States; talks on their return were extended to December 2026 without agreement.',
    members: [
      ...members('BEN CPV CIV GMB GHA LBR NGA SEN SLE TGO'),
      m('GIN', 'Reinstated and all sanctions lifted in January 2026'),
      { iso: 'GNB', status: 'suspended', note: 'Suspended from decision-making bodies since the November 2025 coup' },
    ],
    sources: [{ name: 'ECOWAS member states', url: 'https://ecowas.int/member-states/' }],
    updated: '2026-10',
  },
  {
    id: 'mecca-pact',
    name: 'Mecca Joint Defence Agreement',
    shortName: 'Mecca Pact',
    category: 'security',
    color: '#ff5fa2',
    founded: 2026,
    description:
      'Trilateral mutual-defence treaty signed in Mecca on 7 August 2026 by Saudi Arabia, T\u00fcrkiye and Pakistan, under which an attack on one is treated as an attack on all. It extends the September 2025 Saudi\u2013Pakistani defence pact and is open to other states.',
    members: members('SAU TUR PAK'),
    sources: [
      { name: 'Al Jazeera: T\u00fcrkiye, Saudi Arabia and Pakistan sign joint defence agreement', url: 'https://www.aljazeera.com/news/2026/8/7/turkiye-saudi-arabi-pakistan-sign-joint-defence-agreement-whats-in-it' },
      { name: 'IISS: Pakistan, Saudi Arabia and T\u00fcrkiye: a new defence pact', url: 'https://www.iiss.org/online-analysis/online-analysis/2026/08/pakistan-saudi-arabia-and-turkiye-a-new-defence-pact/' },
    ],
    updated: '2026-10',
  },
  {
    id: 'aes',
    name: 'Alliance of Sahel States',
    shortName: 'AES',
    category: 'security',
    color: '#e76f51',
    founded: 2023,
    description:
      'Mutual-defence pact and confederation of three junta-led Sahel states that broke with ECOWAS and France and turned to Russia for security support.',
    members: members('MLI BFA NER'),
    sources: [{ name: 'Crisis Group: the Alliance of Sahel States', url: 'https://www.crisisgroup.org/africa/sahel' }],
    updated: '2026-10',
  },
];

export const BLOC_BY_ID: ReadonlyMap<string, Bloc> = new Map(BLOCS.map((b) => [b.id, b]));

/** Blocs a country belongs to (any status), in display order. */
export function blocsForCountry(iso: string): Array<{ bloc: Bloc; membership: BlocMember }> {
  const out: Array<{ bloc: Bloc; membership: BlocMember }> = [];
  for (const bloc of BLOCS) {
    const membership = bloc.members.find((x) => x.iso === iso);
    if (membership) out.push({ bloc, membership });
  }
  return out;
}
