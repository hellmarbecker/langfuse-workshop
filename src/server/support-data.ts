import type { SupportContext } from "../shared/types";

export type GuideArticle = {
  id: string;
  title: string;
  searchableTerms: string[];
  summary: string;
  steps: string[];
  caution?: string;
};

export const DEFAULT_SUPPORT_CONTEXT: SupportContext = {
  id: "dad-default",
  label: "Dad",
  relationship: "Dad's everyday setup for calls, photos, travel, printing, and small laptop tasks.",
  devices: ["iPhone 15", "Windows 11 laptop", "HP wireless printer"],
  deviceSummary:
    "Dad mostly uses WhatsApp, Photos, Apple Maps, Chrome, Outlook, and the HP printer. He likes exact button names and calm reassurance before clicking.",
  responseStyle:
    "Talk directly to Dad in second person. Keep the tone calm, practical, and concrete with short numbered steps.",
  notableApps: ["WhatsApp", "Photos", "Apple Maps", "Chrome", "Outlook", "HP Smart"],
  scopeHighlights: [
    "iPhone settings basics",
    "Photos and sharing",
    "Bluetooth and Wi-Fi",
    "Maps basics",
    "Printing and PDF basics",
    "Simple Windows troubleshooting"
  ],
  starterQuestions: [
    "How do I turn Bluetooth on on my iPhone?",
    "How do I take a photo and send it on WhatsApp?",
    "How do I reconnect the laptop to Wi-Fi?",
    "How do I print a PDF?"
  ]
};

export const GUIDE_LIBRARY: GuideArticle[] = [
  {
    id: "iphone-bluetooth",
    title: "Turn Bluetooth on for Dad's iPhone",
    searchableTerms: ["bluetooth", "airpods", "earbuds", "pair", "headphones", "iphone"],
    summary: "Simple Bluetooth steps for Dad's iPhone.",
    steps: [
      "Open the Settings app.",
      "Tap Bluetooth.",
      "Turn Bluetooth on so the switch shows green.",
      "If you are pairing something new, keep that device in pairing mode and wait for its name to appear."
    ],
    caution: "If Bluetooth is already on, the accessory usually still needs to be put into pairing mode."
  },
  {
    id: "iphone-photo-whatsapp",
    title: "Take a photo and send it in WhatsApp",
    searchableTerms: ["photo", "camera", "whatsapp", "send", "picture", "iphone"],
    summary: "Capture and share a photo from Dad's iPhone.",
    steps: [
      "Open Camera and tap the white shutter button to take the photo.",
      "Open WhatsApp and choose the chat you want.",
      "Tap the plus button, then Photo Library or Camera.",
      "Choose the photo and tap Send."
    ]
  },
  {
    id: "iphone-wifi",
    title: "Reconnect Dad's iPhone to Wi-Fi",
    searchableTerms: ["wifi", "wi-fi", "internet", "network", "router", "iphone"],
    summary: "Reconnect the iPhone to home Wi-Fi.",
    steps: [
      "Open Settings and tap Wi-Fi.",
      "Make sure Wi-Fi is turned on.",
      "Tap the home network name.",
      "Enter the Wi-Fi password carefully, then tap Join."
    ],
    caution: "If the network name is missing, move closer to the router and wait a moment for the list to refresh."
  },
  {
    id: "iphone-maps-bus-stop",
    title: "Find directions to a bus stop in Apple Maps",
    searchableTerms: ["bus", "bus stop", "maps", "directions", "travel", "iphone"],
    summary: "Use Apple Maps for nearby bus directions without pretending to see live location.",
    steps: [
      "Open Maps.",
      "Search for the bus stop name or the nearby street.",
      "Tap Directions.",
      "Choose walking or transit if that option appears on the phone."
    ],
    caution: "The workshop demo can explain the taps, but it cannot see Dad's live location."
  },
  {
    id: "windows-print-pdf",
    title: "Print a PDF from Dad's Windows laptop",
    searchableTerms: ["print", "pdf", "printer", "hp", "document", "windows"],
    summary: "Print a PDF with exact button-by-button guidance.",
    steps: [
      "Open the PDF.",
      "Press Control and P together, or click the Print icon.",
      "Choose the HP printer from the printer list.",
      "Click Print."
    ],
    caution: "If the wrong printer is selected, the document can quietly print somewhere else."
  },
  {
    id: "windows-wifi",
    title: "Reconnect Dad's Windows 11 laptop to Wi-Fi",
    searchableTerms: ["wifi", "wi-fi", "internet", "network", "router", "windows", "laptop"],
    summary: "Reconnect to Wi-Fi from the Windows taskbar.",
    steps: [
      "Click the network icon in the bottom-right corner of the taskbar.",
      "Make sure Wi-Fi is turned on.",
      "Choose the home network from the list.",
      "Click Connect and enter the password if asked."
    ]
  },
  {
    id: "windows-bluetooth",
    title: "Pair Bluetooth headphones on Windows 11",
    searchableTerms: ["bluetooth", "headphones", "earbuds", "pair", "audio", "windows"],
    summary: "Pair a Bluetooth device from Windows settings.",
    steps: [
      "Open Settings and click Bluetooth and devices.",
      "Turn Bluetooth on if it is off.",
      "Click Add device, then choose Bluetooth.",
      "Select the headphones when they appear."
    ]
  },
  {
    id: "windows-downloads",
    title: "Find a downloaded file on the laptop",
    searchableTerms: ["downloads", "file", "pdf", "save", "document", "windows", "laptop"],
    summary: "Locate downloaded files through File Explorer.",
    steps: [
      "Open File Explorer.",
      "Click Downloads in the left sidebar.",
      "Look for the newest file near the top if the list is sorted by date.",
      "Double-click the file to open it."
    ]
  }
];

export function getSupportContext() {
  return DEFAULT_SUPPORT_CONTEXT;
}

export function searchGuides(question: string) {
  const normalizedQuestion = question.toLowerCase();
  const terms = normalizedQuestion.split(/[^a-z0-9]+/).filter(Boolean);

  return GUIDE_LIBRARY.map((guide) => {
    const guideText = `${guide.title} ${guide.summary} ${guide.searchableTerms.join(" ")}`.toLowerCase();
    const score = terms.reduce((total, term) => {
      return total + (guideText.includes(term) ? 1 : 0);
    }, 0);

    return { guide, score };
  })
    .filter(({ score }) => score > 0)
    .sort((left, right) => right.score - left.score)
    .slice(0, 3)
    .map(({ guide }) => guide);
}
