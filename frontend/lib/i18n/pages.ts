import type { Locale } from "@/lib/shared/i18n";

export type StaticSlug = "about" | "contact" | "editorial-policy" | "corrections-policy" | "privacy" | "terms";

type Page = { title: Record<Locale, string>; body: Record<Locale, string> };
const p = (...s: string[]) => s.map((x) => `<p>${x}</p>`).join("");
const h = (s: string) => `<h2>${s}</h2>`;

/** Default copy. Administrators can override any page from the dashboard (stored in site settings). Have legal text reviewed before launch. */
export const STATIC_PAGES: Record<StaticSlug, Page> = {
  about: {
    title: { ta: "எங்களைப் பற்றி", en: "About us" },
    body: {
      ta: p("தின இதிகை ஒரு தமிழ் வார இதழ் மற்றும் இணைய செய்தித் தளம். கோவையிலிருந்து தமிழ்நாடு, இந்தியா மற்றும் உலகச் செய்திகளை உடனுக்குடன், நம்பகமாக வழங்குவதே எங்கள் நோக்கம்.", "வாசகர்களும் எங்களுடன் இணையலாம்: கணக்கை உருவாக்கி உங்கள் கட்டுரைகளையும் புகைப்படங்களையும் சமர்ப்பிக்கலாம். ஒவ்வொரு சமர்ப்பிப்பையும் எங்கள் ஆசிரியர் குழு மதிப்பாய்வு செய்த பின்னரே வெளியிடப்படும்."),
      en: p("Dina Idhigai is a Tamil weekly newspaper and news website. Our aim is to bring timely, reliable news from Tamil Nadu, India and the world, reported from Coimbatore.", "Readers can take part too: create an account and submit your own articles and photographs. Every submission is reviewed by our editors before anything is published."),
    },
  },
  contact: {
    title: { ta: "தொடர்புக்கு", en: "Contact us" },
    body: {
      ta: p("செய்திகள், திருத்தங்கள், விளம்பரம் அல்லது பிற விசாரணைகளுக்கு எங்களைத் தொடர்பு கொள்ளவும். தொடர்பு விவரங்கள் இந்தப் பக்கத்தின் அடிப்பகுதியில் உள்ளன."),
      en: p("Get in touch about news tips, corrections, advertising or any other enquiry. Our contact details are shown in the footer of every page."),
    },
  },
  "editorial-policy": {
    title: { ta: "செய்தி நெறிமுறைகள்", en: "Editorial policy" },
    body: {
      ta: h("எங்கள் கொள்கைகள்") + p("துல்லியம், நடுநிலைமை, வெளிப்படைத்தன்மை ஆகியவற்றை நாங்கள் பின்பற்றுகிறோம். ஆதாரங்கள் சரிபார்க்கப்பட்ட பின்பே செய்திகள் வெளியாகும்.") + h("வாசகர் பங்களிப்புகள்") + p("வாசகர்கள் சமர்ப்பிக்கும் கட்டுரைகள் தானாக வெளியாகாது. ஆசிரியர்கள் உண்மைத்தன்மை, மொழி, படங்களின் உரிமை ஆகியவற்றை மதிப்பாய்வு செய்து ஒப்புதல் அளித்த பின்பே வெளியாகும்.") + h("செயற்கை நுண்ணறிவு") + p("ஆசிரியர் குழு மொழிநடையை மேம்படுத்தவும் மொழிபெயர்க்கவும் AI உதவியைப் பயன்படுத்தலாம்; ஆனால் வெளியிடும் முன் ஒவ்வொரு உள்ளடக்கமும் மனிதரால் சரிபார்க்கப்படும்."),
      en: h("Our standards") + p("We aim for accuracy, fairness and transparency. Stories are published only after their facts have been checked against sources.") + h("Reader contributions") + p("Articles submitted by readers are never published automatically. Editors review them for accuracy, language and ownership of photographs, and approve them before publication.") + h("Use of AI") + p("Our editors may use AI tools to improve wording or help with translation, but every piece is checked by a person before it is published."),
    },
  },
  "corrections-policy": {
    title: { ta: "திருத்தக் கொள்கை", en: "Corrections policy" },
    body: {
      ta: p("பிழை கண்டால் தயங்காமல் தெரிவியுங்கள். உண்மைப் பிழைகள் விரைவில் திருத்தப்பட்டு, கட்டுரையில் புதுப்பிக்கப்பட்ட நேரத்துடன் குறிப்பிடப்படும்."),
      en: p("If you spot an error, please tell us. Factual errors are corrected promptly and the article shows its updated time."),
    },
  },
  privacy: {
    title: { ta: "தனியுரிமைக் கொள்கை", en: "Privacy policy" },
    body: {
      ta: h("நாங்கள் சேகரிப்பவை") + p("கணக்கு உருவாக்கும்போது பெயர், மின்னஞ்சல், தொலைபேசி, முகவரி, பாலினம் (விருப்பம்) ஆகியவற்றைச் சேகரிக்கிறோம். இவை அங்கீகரிக்கப்பட்ட ஆசிரியர் குழுவுக்கு மட்டுமே தெரியும்; பொதுவில் காட்டப்படாது.") + h("பயன்பாடு") + p("கணக்கு மேலாண்மை, சமர்ப்பிப்புகளை மதிப்பாய்வு செய்தல், முக்கிய அறிவிப்புகள் அனுப்புதல் ஆகியவற்றுக்கு மட்டும் பயன்படுத்துகிறோம்.") + h("உங்கள் உரிமைகள்") + p("உங்கள் சுயவிவரத்தைத் திருத்தலாம்; கணக்கு நீக்கக் கோரிக்கையும் வைக்கலாம். வெளியான கட்டுரைகள் உங்கள் தனிப்பட்ட விவரங்கள் இன்றி இருக்கும்."),
      en: h("What we collect") + p("When you register we collect your name, email, phone number, address and (optionally) gender. This is visible only to authorised editorial staff and is never shown publicly.") + h("How we use it") + p("To manage your account, review your submissions and send important notices only.") + h("Your rights") + p("You can edit your profile and request deletion of your account at any time. Published articles remain online without your personal details."),
    },
  },
  terms: {
    title: { ta: "பயன்பாட்டு விதிமுறைகள்", en: "Terms of service" },
    body: {
      ta: p("இத்தளத்தைப் பயன்படுத்துவதன் மூலம் இந்த விதிமுறைகளை ஏற்கிறீர்கள். நீங்கள் சமர்ப்பிக்கும் உள்ளடக்கத்துக்கும் புகைப்படங்களுக்கும் உங்களுக்கு உரிமை அல்லது அனுமதி இருக்க வேண்டும். வெளியிடும் உரிமை ஆசிரியர் குழுவிடம் உள்ளது."),
      en: p("By using this site you accept these terms. You must own, or have permission to submit, any content and photographs you send us. The editorial team decides what is published."),
    },
  },
};

export const STATIC_SLUGS = Object.keys(STATIC_PAGES) as StaticSlug[];
