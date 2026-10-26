import type { Locale } from "./config";

// Public website copy. Anything marked PLACEHOLDER is temporary and must be
// replaced with school-approved text before launch (roadmap §3).

const en = {
  meta: {
    siteName: "Uttam Niketan",
    description: "Uttam Niketan is a school in Bihar for children from Nursery to Class 8.",
  },
  nav: {
    home: "Home",
    about: "About",
    academics: "Academics",
    admissions: "Admissions",
    notices: "Notices",
    gallery: "Gallery",
    contact: "Contact",
    menu: "Menu",
    staffLogin: "Staff login",
  },
  language: {
    label: "Language",
    en: "English",
    hi: "हिन्दी",
  },
  placeholderNotice: "Sample content — this will be replaced with text approved by the school.",
  home: {
    eyebrow: "Nursery to Class 8 · Bihar",
    title: "Uttam Niketan",
    // PLACEHOLDER
    tagline: "A caring school where every child learns, grows and belongs.",
    ctaAdmissions: "Admissions information",
    ctaContact: "Contact the school",
    highlightsTitle: "Why families choose us",
    // PLACEHOLDER
    highlights: [
      {
        title: "Strong foundations",
        body: "Early years and primary teaching that builds confident readers and thinkers.",
      },
      { title: "Two languages", body: "Learning in English and Hindi, so children are at home in both." },
      { title: "Close to families", body: "Regular updates for parents and guardians on attendance and school life." },
    ],
    classesTitle: "Classes we offer",
    classes: "Nursery, LKG, UKG and Classes 1 to 8",
    noticesTitle: "Latest notices",
    noticesEmpty: "Notices from the school will appear here.",
    viewAllNotices: "All notices",
  },
  pages: {
    about: { title: "About the school", intro: "Our history, values and the people who run Uttam Niketan." },
    academics: { title: "Academics", intro: "What children learn at each stage, from Nursery to Class 8." },
    admissions: { title: "Admissions", intro: "How to apply, important dates and what to bring." },
    notices: { title: "Notices", intro: "Announcements and updates from the school." },
    gallery: { title: "Gallery", intro: "Photographs of school events and everyday life." },
    contact: { title: "Contact", intro: "Address, phone numbers and office hours." },
  },
  comingSoon: "This page is being prepared with the school and will be available soon.",
  footer: {
    rights: "All rights reserved.",
    // PLACEHOLDER until the school confirms its address
    address: "Bihar, India",
  },
};

export type Dictionary = typeof en;

const hi: Dictionary = {
  meta: {
    siteName: "उत्तम निकेतन",
    description: "उत्तम निकेतन बिहार का एक विद्यालय है, जहाँ नर्सरी से कक्षा 8 तक की पढ़ाई होती है।",
  },
  nav: {
    home: "मुख्य पृष्ठ",
    about: "परिचय",
    academics: "शिक्षा",
    admissions: "प्रवेश",
    notices: "सूचनाएँ",
    gallery: "चित्र दीर्घा",
    contact: "संपर्क",
    menu: "मेनू",
    staffLogin: "स्टाफ लॉगिन",
  },
  language: {
    label: "भाषा",
    en: "English",
    hi: "हिन्दी",
  },
  placeholderNotice: "नमूना सामग्री — इसे विद्यालय द्वारा स्वीकृत पाठ से बदला जाएगा।",
  home: {
    eyebrow: "नर्सरी से कक्षा 8 · बिहार",
    title: "उत्तम निकेतन",
    tagline: "एक स्नेहपूर्ण विद्यालय, जहाँ हर बच्चा सीखता है, आगे बढ़ता है और अपनापन पाता है।",
    ctaAdmissions: "प्रवेश की जानकारी",
    ctaContact: "विद्यालय से संपर्क करें",
    highlightsTitle: "परिवार हमें क्यों चुनते हैं",
    highlights: [
      {
        title: "मज़बूत नींव",
        body: "शुरुआती और प्राथमिक कक्षाओं में ऐसी पढ़ाई, जो बच्चों को आत्मविश्वासी पाठक और विचारक बनाती है।",
      },
      { title: "दो भाषाएँ", body: "अंग्रेज़ी और हिन्दी दोनों में पढ़ाई, ताकि बच्चे दोनों भाषाओं में सहज रहें।" },
      {
        title: "परिवारों से जुड़ाव",
        body: "उपस्थिति और विद्यालय की गतिविधियों के बारे में अभिभावकों को नियमित जानकारी।",
      },
    ],
    classesTitle: "हमारी कक्षाएँ",
    classes: "नर्सरी, एलकेजी, यूकेजी और कक्षा 1 से 8",
    noticesTitle: "नई सूचनाएँ",
    noticesEmpty: "विद्यालय की सूचनाएँ यहाँ दिखाई देंगी।",
    viewAllNotices: "सभी सूचनाएँ",
  },
  pages: {
    about: { title: "विद्यालय का परिचय", intro: "उत्तम निकेतन का इतिहास, मूल्य और इसे चलाने वाले लोग।" },
    academics: { title: "शिक्षा", intro: "नर्सरी से कक्षा 8 तक, हर चरण में बच्चे क्या सीखते हैं।" },
    admissions: { title: "प्रवेश", intro: "आवेदन कैसे करें, महत्वपूर्ण तिथियाँ और आवश्यक दस्तावेज़।" },
    notices: { title: "सूचनाएँ", intro: "विद्यालय की घोषणाएँ और नई जानकारी।" },
    gallery: { title: "चित्र दीर्घा", intro: "विद्यालय के कार्यक्रमों और रोज़मर्रा की झलकियाँ।" },
    contact: { title: "संपर्क", intro: "पता, फ़ोन नंबर और कार्यालय का समय।" },
  },
  comingSoon: "यह पृष्ठ विद्यालय के साथ मिलकर तैयार किया जा रहा है और जल्द उपलब्ध होगा।",
  footer: {
    rights: "सर्वाधिकार सुरक्षित।",
    address: "बिहार, भारत",
  },
};

const dictionaries: Record<Locale, Dictionary> = { en, hi };

export function getDictionary(locale: Locale): Dictionary {
  return dictionaries[locale];
}
