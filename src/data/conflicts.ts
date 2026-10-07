import { DEFAULT_CONFLICT_SOURCES, TRACKERS } from './sources';
import type { Conflict } from './types';

/**
 * Snapshot of significant armed conflicts and flashpoints. Each entry carries
 * an `updated` month: treat anything older than a few months as background,
 * not news, and check the linked trackers before relying on it.
 */
export const CONFLICTS: Conflict[] = [
  {
    id: 'russia-ukraine',
    name: 'Russia–Ukraine war',
    type: 'interstate',
    intensity: 'high',
    since: 2014,
    location: [37.6, 48.1],
    countries: ['UKR', 'RUS'],
    parties: ['Russia', 'Ukraine (backed by NATO members and the EU)'],
    summary:
      'Russia seized Crimea and parts of the Donbas in 2014 and launched a full-scale invasion in February 2022. The war became the largest in Europe since 1945, with attritional ground fighting across the east and south and long-range strike campaigns by both sides.',
    status:
      'Front lines moved slowly through 2025, mostly in Russia’s favour in Donetsk oblast, while Ukraine struck Russian refineries and airbases at depth. US-mediated talks in 2025 produced no settlement; fighting continued into 2026.',
    sources: [TRACKERS.isw, TRACKERS.cfr, TRACKERS.acled],
    updated: '2025-12',
  },
  {
    id: 'sudan',
    name: 'Sudan civil war',
    type: 'civil-war',
    intensity: 'high',
    since: 2023,
    location: [25.4, 13.6],
    countries: ['SDN'],
    parties: ['Sudanese Armed Forces (SAF)', 'Rapid Support Forces (RSF)'],
    summary:
      'A power struggle between the army and the paramilitary RSF erupted into open war in Khartoum in April 2023. It has produced the world’s largest displacement crisis, famine conditions, and mass atrocities in Darfur.',
    status:
      'The army retook Khartoum in March 2025. The RSF captured El Fasher, the last army stronghold in Darfur, in October 2025 amid reports of mass killings, and declared a rival government. The country is effectively partitioned east–west.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'gaza',
    name: 'Israel–Hamas war (Gaza)',
    type: 'asymmetric',
    intensity: 'medium',
    since: 2023,
    location: [34.45, 31.45],
    countries: ['ISR', 'PSE'],
    parties: ['Israel', 'Hamas and allied Palestinian factions'],
    summary:
      'Hamas’s 7 October 2023 attack killed about 1,200 people in Israel and took some 250 hostages. Israel’s ensuing campaign devastated Gaza, killing tens of thousands and displacing most of the population, and triggered a wider regional confrontation.',
    status:
      'A US-brokered ceasefire took effect in October 2025 with the release of the remaining living hostages. Later phases covering disarmament, governance and reconstruction remained contested, and Israeli strikes and localised fighting continued at a lower level.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'israel-lebanon',
    name: 'Israel–Hezbollah conflict',
    type: 'asymmetric',
    intensity: 'low',
    since: 2023,
    location: [35.5, 33.3],
    countries: ['LBN', 'ISR'],
    parties: ['Israel', 'Hezbollah'],
    summary:
      'Hezbollah opened a front in support of Hamas in October 2023. Israel escalated in September 2024 with pager attacks, the killing of Hassan Nasrallah and a ground incursion into southern Lebanon.',
    status:
      'A ceasefire in November 2024 largely held, though Israel kept five positions inside Lebanon and continued near-daily strikes. The Lebanese government adopted a plan in August 2025 to bring all weapons under state control.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'iran-israel',
    name: 'Iran–Israel confrontation',
    type: 'interstate',
    intensity: 'latent',
    since: 2024,
    location: [51.4, 33.6],
    countries: ['IRN', 'ISR', 'USA'],
    parties: ['Iran', 'Israel', 'United States'],
    summary:
      'Decades of shadow war became direct exchanges of missile and drone fire in April and October 2024. In June 2025 Israel launched a twelve-day air campaign against Iranian nuclear and military targets; the United States struck the Fordow, Natanz and Isfahan sites.',
    status:
      'A ceasefire took hold on 24 June 2025. European parties triggered the "snapback" of UN sanctions on Iran in September 2025. Iran’s nuclear programme status and the risk of renewed strikes remain the central uncertainty.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'yemen',
    name: 'Yemen war and Red Sea crisis',
    type: 'civil-war',
    intensity: 'medium',
    since: 2014,
    location: [44.2, 15.35],
    countries: ['YEM', 'SAU', 'ISR'],
    parties: ['Houthis (Ansar Allah)', 'Internationally recognised government and Saudi-led coalition', 'United States and Israel (air campaigns)'],
    summary:
      'The Houthis seized Sanaa in 2014 and have fought a Saudi-led coalition since 2015. From late 2023 they attacked Red Sea shipping in solidarity with Gaza, prompting US, UK and Israeli strikes.',
    status:
      'A US air campaign in March–May 2025 ended with a truce covering US ships only. Houthi–Israeli exchanges continued, including Israeli strikes that killed much of the Houthi cabinet in August 2025. The internal front is frozen under a 2022 de facto truce.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'syria',
    name: 'Syria transition',
    type: 'civil-war',
    intensity: 'medium',
    since: 2011,
    location: [38.3, 35.0],
    countries: ['SYR', 'ISR', 'TUR'],
    parties: ['Transitional government (former HTS)', 'Syrian Democratic Forces', 'Alawite and Druze armed groups', 'Israel and Türkiye (external operations)'],
    summary:
      'A rebel offensive toppled Bashar al-Assad in December 2024, ending 13 years of civil war. The new government under Ahmed al-Sharaa faces sectarian violence, armed holdouts, and Israeli and Turkish military operations on its territory.',
    status:
      'Mass killings of Alawites on the coast (March 2025) and Druze–Bedouin fighting in Sweida (July 2025) exposed weak state control. A March 2025 deal to integrate the Kurdish-led SDF was only partly implemented. Most Western sanctions were lifted during 2025.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'myanmar',
    name: 'Myanmar civil war',
    type: 'civil-war',
    intensity: 'high',
    since: 2021,
    location: [96.1, 21.5],
    countries: ['MMR'],
    parties: ['Military junta (State Administration Council)', 'People’s Defence Forces and ethnic armed organisations'],
    summary:
      'The February 2021 coup triggered nationwide armed resistance. Ethnic armies and the opposition National Unity Government’s forces have taken large parts of the border regions, and the junta has responded with air strikes and mass conscription.',
    status:
      'The junta lost further territory in 2024–2025 but regained some ground with Chinese pressure on northern ethnic groups. A devastating earthquake in March 2025 did not pause the fighting. The junta staged phased elections from December 2025 that the opposition boycotted.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'sahel',
    name: 'Central Sahel insurgency',
    type: 'insurgency',
    intensity: 'high',
    since: 2012,
    location: [-1.5, 15.0],
    countries: ['MLI', 'BFA', 'NER'],
    parties: ['JNIM (al-Qaeda affiliate)', 'Islamic State Sahel Province', 'Mali, Burkina Faso and Niger armed forces with Russia’s Africa Corps'],
    summary:
      'Jihadist insurgencies that began in northern Mali in 2012 have spread across Burkina Faso and Niger and towards coastal West Africa. Military juntas expelled French and UN forces and brought in Russian contractors.',
    status:
      'JNIM expanded its reach in 2025, besieging towns in Burkina Faso and imposing a fuel blockade on Bamako from September 2025 that strained the Malian capital. The three juntas formalised their confederation and left ECOWAS in January 2025.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'drc-east',
    name: 'Eastern DR Congo (M23)',
    type: 'insurgency',
    intensity: 'high',
    since: 2021,
    location: [29.2, -1.7],
    countries: ['COD', 'RWA', 'UGA', 'BDI'],
    parties: ['M23 / Congo River Alliance (backed by Rwanda)', 'DRC armed forces and allied militias', 'Burundian and Ugandan forces'],
    summary:
      'The Rwanda-backed M23 rebellion resurged in 2021 and captured the provincial capitals Goma (January 2025) and Bukavu (February 2025), displacing millions in a region with over a hundred armed groups.',
    status:
      'A US-brokered DRC–Rwanda agreement in June 2025 and a Qatar-mediated framework with M23 in July 2025 did not stop fighting on the ground. M23 consolidated a parallel administration in North and South Kivu.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'somalia',
    name: 'Somalia (al-Shabaab)',
    type: 'insurgency',
    intensity: 'medium',
    since: 2006,
    location: [45.3, 2.1],
    countries: ['SOM'],
    parties: ['Al-Shabaab', 'Federal Government of Somalia with AU mission (AUSSOM) and US air support'],
    summary:
      'Al-Qaeda’s East African affiliate controls much of rural southern Somalia and stages attacks in Mogadishu. The AU mission was re-hatted as AUSSOM in January 2025 with uncertain funding.',
    status:
      'Al-Shabaab retook ground in Middle and Lower Shabelle in 2025, reversing much of the 2022–2023 offensive. Disputes between Mogadishu and the Puntland and Jubaland administrations weakened the government’s position ahead of 2026 elections.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'ethiopia',
    name: 'Ethiopia internal conflicts',
    type: 'insurgency',
    intensity: 'medium',
    since: 2023,
    location: [38.7, 11.6],
    countries: ['ETH', 'ERI'],
    parties: ['Federal government', 'Fano militias (Amhara)', 'Oromo Liberation Army', 'TPLF factions'],
    summary:
      'After the 2020–2022 Tigray war ended, insurgencies by Amhara Fano militias and the Oromo Liberation Army spread. Tigray’s ruling party split in 2025, and tensions with Eritrea over access to the sea rose sharply.',
    status:
      'Fighting in Amhara and Oromia continued through 2025 with drone strikes and mass detentions. Fears of a renewed Ethiopia–Eritrea war, possibly drawing in Tigray, grew in late 2025.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'south-sudan',
    name: 'South Sudan',
    type: 'civil-war',
    intensity: 'medium',
    since: 2013,
    location: [31.6, 4.9],
    countries: ['SSD'],
    parties: ['Government (SPLM) under Salva Kiir', 'SPLM-IO under Riek Machar', 'White Army and other militias'],
    summary:
      'A 2018 peace deal paused the civil war but was never fully implemented. Clashes in Upper Nile in early 2025 and the arrest of First Vice-President Riek Machar in March 2025 put the agreement in jeopardy.',
    status:
      'Government air strikes and ground offensives against SPLM-IO positions continued in 2025. Machar was put on trial in September 2025. Elections were postponed to December 2026.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'haiti',
    name: 'Haiti gang conflict',
    type: 'criminal-violence',
    intensity: 'high',
    since: 2021,
    location: [-72.33, 18.55],
    countries: ['HTI'],
    parties: ['Viv Ansanm gang coalition', 'Haitian National Police and the multinational force'],
    summary:
      'Gangs control most of Port-au-Prince and major roads, and have displaced over a million people. A Kenya-led Multinational Security Support mission arrived in 2024 but was under-resourced.',
    status:
      'The UN Security Council authorised a larger Gang Suppression Force in September 2025 to replace the Kenyan-led mission. Violence spread to the Artibonite and Centre departments, and the transitional government’s mandate runs to February 2026.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'nigeria',
    name: 'Nigeria (north-east and north-west)',
    type: 'insurgency',
    intensity: 'medium',
    since: 2009,
    location: [13.2, 11.8],
    countries: ['NGA'],
    parties: ['Boko Haram (JAS)', 'Islamic State West Africa Province', 'Armed bandit groups', 'Nigerian armed forces'],
    summary:
      'The Boko Haram insurgency and its Islamic State offshoot persist around Lake Chad, while mass-kidnapping bandit groups dominate the north-west and farmer–herder violence afflicts the Middle Belt.',
    status:
      'ISWAP staged a series of overruns of army bases in Borno in 2025. Lakurawa, a new jihadist group, emerged in the north-west. Nigerian forces increased air strikes but security remained poor across the north.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'mozambique',
    name: 'Cabo Delgado insurgency',
    type: 'insurgency',
    intensity: 'low',
    since: 2017,
    location: [40.3, -12.9],
    countries: ['MOZ'],
    parties: ['Islamic State Mozambique', 'Mozambican forces with Rwandan troops'],
    summary:
      'An Islamic State-affiliated insurgency in the gas-rich northern province displaced hundreds of thousands and stalled multibillion-dollar LNG projects.',
    status:
      'Attacks continued at a lower level in 2025 as Rwandan forces held key towns and the SADC mission withdrew. TotalEnergies moved to restart its Afungi LNG project.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'colombia',
    name: 'Colombia armed groups',
    type: 'insurgency',
    intensity: 'medium',
    since: 2016,
    location: [-72.9, 8.3],
    countries: ['COL'],
    parties: ['ELN', 'FARC dissident factions', 'Clan del Golfo', 'Colombian armed forces'],
    summary:
      'Armed groups that filled the vacuum after the 2016 FARC peace deal fight each other and the state over coca, mining and smuggling corridors. The "total peace" talks launched in 2022 largely collapsed.',
    status:
      'ELN attacks on FARC dissidents in Catatumbo in January 2025 displaced tens of thousands and led the government to suspend talks. Violence in Cauca and the Pacific coast intensified ahead of the 2026 elections.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'mexico',
    name: 'Mexico cartel violence',
    type: 'criminal-violence',
    intensity: 'medium',
    since: 2006,
    location: [-107.4, 24.8],
    countries: ['MEX'],
    parties: ['Sinaloa Cartel factions (Chapitos vs. Mayiza)', 'Jalisco New Generation Cartel', 'Mexican security forces'],
    summary:
      'Rivalries among cartels and with the state produce tens of thousands of homicides a year. A war inside the Sinaloa Cartel began in September 2024 after the capture of Ismael "El Mayo" Zambada.',
    status:
      'The United States designated major cartels as foreign terrorist organisations in February 2025 and pressed Mexico with tariff threats. Mexico extradited dozens of cartel figures and expanded army deployments, but fighting in Sinaloa continued.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'india-pakistan',
    name: 'India–Pakistan (Kashmir)',
    type: 'interstate',
    intensity: 'latent',
    since: 1947,
    location: [74.8, 34.1],
    countries: ['IND', 'PAK'],
    parties: ['India', 'Pakistan'],
    summary:
      'Nuclear-armed rivals that have fought three wars over Kashmir. A militant attack on tourists at Pahalgam in April 2025 triggered the most serious crisis since 1999.',
    status:
      'India struck targets in Pakistan on 7 May 2025 ("Operation Sindoor") and four days of missile, drone and air combat followed before a ceasefire on 10 May. India kept the Indus Waters Treaty in abeyance, and the line of control stayed tense.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'pakistan-afghanistan',
    name: 'Pakistan insurgencies and Afghan border',
    type: 'insurgency',
    intensity: 'medium',
    since: 2021,
    location: [70.0, 33.0],
    countries: ['PAK', 'AFG'],
    parties: ['Tehrik-i-Taliban Pakistan', 'Baloch Liberation Army', 'Pakistani armed forces', 'Taliban government of Afghanistan'],
    summary:
      'Militant violence in Pakistan surged after the Taliban’s 2021 takeover of Afghanistan gave the TTP a haven. Baloch separatists escalated with attacks such as the March 2025 hijacking of the Jaffar Express.',
    status:
      'Pakistani air strikes in Afghanistan and Taliban retaliation produced the heaviest border fighting in years in October 2025, followed by a Qatar- and Türkiye-mediated ceasefire. Attacks in Khyber Pakhtunkhwa and Balochistan remained at record levels.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'libya',
    name: 'Libya',
    type: 'civil-war',
    intensity: 'low',
    since: 2011,
    location: [13.2, 32.9],
    countries: ['LBY'],
    parties: ['Government of National Unity (Tripoli)', 'Libyan National Army and House of Representatives (east)', 'Tripoli militias'],
    summary:
      'Libya has been split between rival governments in Tripoli and the east since 2014. A 2020 ceasefire holds between them, but Tripoli’s armed groups periodically fight each other.',
    status:
      'The killing of a powerful militia leader in May 2025 set off the heaviest clashes in Tripoli in years and protests against the prime minister. UN efforts to agree an electoral roadmap continued without a breakthrough.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'thailand-cambodia',
    name: 'Thailand–Cambodia border',
    type: 'interstate',
    intensity: 'latent',
    since: 2025,
    location: [103.0, 14.4],
    countries: ['THA', 'KHM'],
    parties: ['Thailand', 'Cambodia'],
    summary:
      'A long-running dispute over temples along the border escalated into five days of artillery, rocket and air strikes in July 2025 that killed dozens and displaced hundreds of thousands.',
    status:
      'A Malaysia-brokered ceasefire on 28 July 2025 was followed by a peace accord signed in Kuala Lumpur in October 2025. Landmine incidents and troop deployments kept the border tense.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'taiwan-strait',
    name: 'Taiwan Strait',
    type: 'flashpoint',
    intensity: 'latent',
    since: 1949,
    location: [120.0, 24.0],
    countries: ['CHN', 'TWN'],
    parties: ['People’s Republic of China', 'Taiwan (Republic of China)', 'United States (security partner)'],
    summary:
      'Beijing claims Taiwan and has not renounced force. Chinese air and naval activity around the island has reached record levels, with large-scale exercises rehearsing a blockade.',
    status:
      'The PLA staged "Strait Thunder-2025A" drills in April 2025 and continued near-daily incursions into Taiwan’s air-defence identification zone. Taiwan raised defence spending and held expanded Han Kuang exercises.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'korean-peninsula',
    name: 'Korean Peninsula',
    type: 'flashpoint',
    intensity: 'latent',
    since: 1953,
    location: [126.9, 38.3],
    countries: ['PRK', 'KOR'],
    parties: ['North Korea', 'South Korea', 'United States'],
    summary:
      'The 1953 armistice was never replaced by a peace treaty. North Korea has an expanding nuclear and missile arsenal and declared the South a "hostile state" in 2024.',
    status:
      'North Korea deepened its alliance with Russia, sending troops to fight in Kursk in 2024–2025. South Korea’s new government elected in June 2025 sought to lower tensions, but Pyongyang rejected dialogue.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'south-china-sea',
    name: 'South China Sea',
    type: 'flashpoint',
    intensity: 'low',
    since: 2012,
    location: [116.0, 12.0],
    countries: ['CHN', 'PHL', 'VNM'],
    parties: ['China', 'Philippines', 'Vietnam and other claimants', 'United States (treaty ally of the Philippines)'],
    summary:
      'Overlapping maritime claims and China’s militarised artificial islands produce regular confrontations, especially between Chinese coast guard vessels and Philippine resupply missions.',
    status:
      'Chinese water-cannon and ramming incidents at Scarborough Shoal and Second Thomas Shoal continued through 2025, and Beijing declared a "nature reserve" at Scarborough in September 2025. The Philippines expanded joint patrols with the US, Japan and Australia.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'armenia-azerbaijan',
    name: 'Armenia–Azerbaijan peace process',
    type: 'flashpoint',
    intensity: 'latent',
    since: 2020,
    location: [46.5, 39.6],
    countries: ['ARM', 'AZE'],
    parties: ['Armenia', 'Azerbaijan'],
    summary:
      'Azerbaijan won the 2020 war and retook all of Nagorno-Karabakh in September 2023, prompting the exodus of its Armenian population. The two states then negotiated a peace treaty.',
    status:
      'The leaders initialled a peace agreement at the White House in August 2025, including a US-managed transit corridor through southern Armenia. Signature awaited Armenian constitutional changes, and the border remained militarised.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
  {
    id: 'venezuela-us',
    name: 'Venezuela–United States',
    type: 'interstate',
    intensity: 'low',
    since: 2025,
    location: [-66.9, 10.5],
    countries: ['VEN', 'USA'],
    parties: ['United States', 'Venezuelan government and armed forces'],
    summary:
      'Washington declared an armed conflict with drug-trafficking cartels it links to Venezuela’s government, deployed a large naval force to the Caribbean and, from September 2025, struck boats it said were carrying narcotics.',
    status:
      'The build-up and strikes continued through late 2025 alongside threats of action on Venezuelan soil. In early 2026 the United States carried out strikes in Caracas and removed Nicolás Maduro from power, opening a contested political transition.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2026-02',
  },
  {
    id: 'cameroon-anglophone',
    name: 'Cameroon Anglophone crisis',
    type: 'insurgency',
    intensity: 'low',
    since: 2017,
    location: [10.1, 5.95],
    countries: ['CMR'],
    parties: ['Ambazonian separatist groups', 'Cameroonian armed forces'],
    summary:
      'Protests over the marginalisation of Cameroon’s English-speaking regions turned into a separatist insurgency in 2017. Both sides have been accused of atrocities, and schools and markets are frequent targets.',
    status:
      'Low-intensity attacks and "ghost town" lockdowns continued in 2025. A disputed October 2025 presidential election that returned Paul Biya, 92, to office prompted protests across the country.',
    sources: DEFAULT_CONFLICT_SOURCES,
    updated: '2025-12',
  },
];

export const CONFLICT_BY_ID: ReadonlyMap<string, Conflict> = new Map(CONFLICTS.map((c) => [c.id, c]));

export function conflictsForCountry(iso: string): Conflict[] {
  return CONFLICTS.filter((c) => c.countries.includes(iso));
}

export const INTENSITY_ORDER: Record<Conflict['intensity'], number> = { high: 3, medium: 2, low: 1, latent: 0 };
