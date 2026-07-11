import { useState } from 'react';
import { BookOpen, Search, Target, Users, Shield, Briefcase, Zap, ShieldCheck, Database, Megaphone } from 'lucide-react';

interface StatusDefinition {
  name: string;
  category: string;
  englishMeaning: string;
  hindiMeaning: string;
}

const statusDefinitions: StatusDefinition[] = [
  // Sales Stage
  { name: 'New', category: 'Sales Stage', englishMeaning: 'Newly added lead, no contact initiated yet.', hindiMeaning: 'नया लीड जोड़ा गया है, अभी तक कोई संपर्क नहीं हुआ है।' },
  { name: 'Contacted', category: 'Sales Stage', englishMeaning: 'Initial contact has been made with the lead.', hindiMeaning: 'लीड से शुरुआती संपर्क (बातचीत) हो चुकी है।' },
  { name: 'Qualified', category: 'Sales Stage', englishMeaning: 'Lead matches our target criteria and has potential.', hindiMeaning: 'लीड हमारे क्राइटेरिया से मैच करती है और इसमें पोटेंशियल (संभावना) है।' },
  { name: 'Follow-up', category: 'Sales Stage', englishMeaning: 'Scheduled for a future check-in or discussion.', hindiMeaning: 'भविष्य में बातचीत या चेक-इन के लिए शेड्यूल किया गया है।' },
  { name: 'Negotiation', category: 'Sales Stage', englishMeaning: 'Currently discussing terms, pricing, or contract details.', hindiMeaning: 'फिलहाल कीमत या कॉन्ट्रैक्ट की शर्तों पर बातचीत (नेगोशिएशन) चल रही है।' },
  { name: 'Client Won', category: 'Sales Stage', englishMeaning: 'Successfully converted into a paying client.', hindiMeaning: 'सफलतापूर्वक क्लाइंट में बदल गया है (डील पक्की हो गई है)।' },
  { name: 'Client Lost', category: 'Sales Stage', englishMeaning: 'Lead decided not to proceed with us.', hindiMeaning: 'लीड ने हमारे साथ आगे न बढ़ने का फैसला किया है।' },
  { name: 'Do Not Contact', category: 'Sales Stage', englishMeaning: 'Requested not to be contacted again.', hindiMeaning: 'दोबारा संपर्क न करने का अनुरोध किया है।' },

  // Verification
  { name: 'Imported', category: 'Verification', englishMeaning: 'Data uploaded via CSV/Excel, pending checks.', hindiMeaning: 'डेटा CSV/Excel से अपलोड हुआ है, अभी चेक होना बाकी है।' },
  { name: 'Enrichment Pending', category: 'Verification', englishMeaning: 'Waiting for additional background data/verification.', hindiMeaning: 'बैकग्राउंड डेटा या वेरिफिकेशन का इंतज़ार किया जा रहा है।' },
  { name: 'Active', category: 'Verification', englishMeaning: 'Confirmed as a valid and reachable contact.', hindiMeaning: 'यह एक सही और संपर्क करने योग्य लीड कन्फर्म हुई है।' },
  { name: 'Likely Inactive', category: 'Verification', englishMeaning: 'Contact info might be outdated or unreachable.', hindiMeaning: 'संपर्क जानकारी पुरानी हो सकती है या संपर्क नहीं हो पा रहा है।' },
  { name: 'Unverified', category: 'Verification', englishMeaning: 'Not yet checked for validity.', hindiMeaning: 'अभी तक इसकी सत्यता (validity) जांची नहीं गई है।' },
  { name: 'Duplicate', category: 'Verification', englishMeaning: 'Found as a duplicate of an existing lead.', hindiMeaning: 'सिस्टम में पहले से मौजूद लीड की कॉपी (डुप्लीकेट) मिली है।' },

  // Engagement
  { name: 'Not Engaged', category: 'Engagement', englishMeaning: 'No interactions recorded yet.', hindiMeaning: 'अभी तक कोई इंटरेक्शन (बातचीत/क्लिक) रिकॉर्ड expanded नहीं हुआ है।' },
  { name: 'Sent', category: 'Engagement', englishMeaning: 'Message/Email has been sent to the lead.', hindiMeaning: 'लीड को मैसेज या ईमेल भेज दिया गया है।' },
  { name: 'Delivered', category: 'Engagement', englishMeaning: 'Message/Email successfully reached the lead\'s inbox.', hindiMeaning: 'मैसेज/ईमेल सफलतापूर्वक लीड के इनबॉक्स में पहुँच गया है।' },
  { name: 'Opened', category: 'Engagement', englishMeaning: 'Lead opened the sent communication.', hindiMeaning: 'लीड ने भेजा गया ईमेल/मैसेज खोल कर देखा है।' },
  { name: 'Clicked', category: 'Engagement', englishMeaning: 'Lead clicked a link within the communication.', hindiMeaning: 'लीड ने ईमेल/मैसेज में दिए गए लिंक पर क्लिक किया है।' },
  { name: 'Replied', category: 'Engagement', englishMeaning: 'Lead has responded to our communication.', hindiMeaning: 'लीड ने हमारे मैसेज/ईमेल का जवाब (रिप्लाई) दिया है।' },
  { name: 'Demo Requested', category: 'Engagement', englishMeaning: 'Lead explicitly asked for a product demo.', hindiMeaning: 'लीड ने खुद से प्रोडक्ट डेमो के लिए रिक्वेस्ट की है।' },

  // Consent
  { name: 'Unknown', category: 'Consent', englishMeaning: 'No explicit consent record found.', hindiMeaning: 'सहमति (Consent) का कोई स्पष्ट रिकॉर्ड नहीं है।' },
  { name: 'Opted In', category: 'Consent', englishMeaning: 'Lead gave explicit permission to be contacted.', hindiMeaning: 'लीड ने संपर्क करने की साफ़ तौर पर अनुमति दी है (Opt-in)।' },
  { name: 'Opted Out', category: 'Consent', englishMeaning: 'Lead revoked permission to be contacted.', hindiMeaning: 'लीड ने संपर्क करने की अनुमति वापस ले ली है (Opt-out)।' },
  { name: 'Implied B2B', category: 'Consent', englishMeaning: 'Business contact where consent is generally implied.', hindiMeaning: 'यह एक B2B कॉन्टैक्ट है जहाँ बिज़नेस पर्पस से संपर्क करना आम बात है।' },
];

export default function StatusDictionary() {
  const [activeTab, setActiveTab] = useState<'status' | 'docs'>('docs');
  const [search, setSearch] = useState('');
  const [docsLanguage, setDocsLanguage] = useState<'en' | 'hi'>('hi');

  const filteredStatuses = statusDefinitions.filter(status =>
    status.name.toLowerCase().includes(search.toLowerCase()) ||
    status.category.toLowerCase().includes(search.toLowerCase()) ||
    status.englishMeaning.toLowerCase().includes(search.toLowerCase()) ||
    status.hindiMeaning.includes(search)
  );

  const categories = Array.from(new Set(filteredStatuses.map(s => s.category)));

  return (
    <div className="mx-auto max-w-6xl flex flex-col gap-8 pb-12">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
                Dictionary & Documentation
              </h1>
              <p className="mt-1 text-sm font-medium text-[#64748B]">
                Understand system workflows, user roles, and lead status definitions.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-slate-200">
        <button
          onClick={() => setActiveTab('docs')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'docs'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
        >
          System Documentation
        </button>
        <button
          onClick={() => setActiveTab('status')}
          className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'status'
            ? 'border-blue-600 text-blue-600'
            : 'border-transparent text-slate-500 hover:text-slate-800 hover:border-slate-300'
            }`}
        >
          Lead Status Definitions
        </button>
      </div>

      {/* Content Area */}
      <div>
        {/* TAB 1: System Documentation */}
        {activeTab === 'docs' && (
          <div className="flex flex-col gap-8 animate-in fade-in slide-in-from-bottom-2 duration-300">
            {/* Language Toggle */}
            <div className="flex justify-end">
              <div className="flex items-center bg-slate-100 rounded-lg p-1 border border-slate-200 w-fit">
                <button
                  onClick={() => setDocsLanguage('en')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${docsLanguage === 'en' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  English
                </button>
                <button
                  onClick={() => setDocsLanguage('hi')}
                  className={`px-4 py-1.5 text-sm font-semibold rounded-md transition-colors ${docsLanguage === 'hi' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  Hindi
                </button>
              </div>
            </div>

            {docsLanguage === 'en' ? (
              <div className="space-y-8 animate-fade-in">
                {/* 1. What and Why (English) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                      <Target className="h-5 w-5 text-indigo-500" />
                      What is AlgoConnect?
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      AlgoConnect is a powerful B2B outbound marketing and CRM platform designed specifically to target financial intermediaries in India, such as SEBI Research Analysts (RAs), Investment Advisors (IAs), and NSE Sub-brokers. It aggregates raw market data, enriches it to verify activity, and facilitates multi-channel outreach (Email, SMS, WhatsApp).
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Why was this project created?
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Acquiring and engaging financial intermediaries is highly manual and compliance-heavy. AlgoConnect was built to automate lead aggregation, filter out inactive entities via enrichment, group them into smart segments, and launch strictly compliant, scalable messaging campaigns to generate warm leads for the sales team.
                    </p>
                  </div>
                </div>

                {/* 2. Roles in the App (English) */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2 border-b border-[#E2E8F0] pb-4">
                    <Users className="h-5 w-5 text-emerald-500" />
                    User Roles & Permissions
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-blue-900">System Admin</h3>
                      </div>
                      <p className="text-sm text-blue-800/80 leading-relaxed">
                        Has unrestricted access to the entire platform. Responsible for creating other user accounts, configuring API integrations, webhooks, and setting up the communication gateways (SMTP, Twilio) in System Settings.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-purple-50/50 border border-purple-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="h-5 w-5 text-purple-600" />
                        <h3 className="font-bold text-purple-900">Growth Operator</h3>
                      </div>
                      <p className="text-sm text-purple-800/80 leading-relaxed">
                        The primary marketer. They import lead lists (CSV/XLSX), run enrichment jobs to verify leads, build targeted Segments (e.g. "Active RAs in Delhi"), and launch outbound Campaigns to engage those segments.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-5 w-5 text-amber-600" />
                        <h3 className="font-bold text-amber-900">Compliance Admin</h3>
                      </div>
                      <p className="text-sm text-amber-800/80 leading-relaxed">
                        Ensures all operations are legally compliant. They approve or reject message templates to ensure they meet DLT/TRAI standards, monitor audit logs, and enforce global "Do Not Contact" (DND) consent lists.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-emerald-900">Sales Rep</h3>
                      </div>
                      <p className="text-sm text-emerald-800/80 leading-relaxed">
                        The closer. They have restricted access, primarily viewing leads that have engaged with campaigns and have been marked as "warm" or "qualified", allowing them to focus purely on outreach and sales conversions.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Page Dictionary (English) */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2 border-b border-[#E2E8F0] pb-4">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Page Dictionary & Workflows
                  </h2>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><Database className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Lead Management</h4>
                        <p className="text-sm text-slate-600 mt-1">The central database for all contacts. This page allows you to import raw lists from SEBI/NSE, trigger enrichment jobs to verify if the business is active, and view detailed profiles and engagement history for every single lead.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><Target className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Segments</h4>
                        <p className="text-sm text-slate-600 mt-1">Instead of blasting all 10,000 leads, Segments allow you to build dynamic, rule-based filters (e.g., "Lead Score {">"} 80" + "Region: Maharashtra"). You create segments here before attaching them to a campaign.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><Megaphone className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Campaigns</h4>
                        <p className="text-sm text-slate-600 mt-1">The core execution engine. Here, you take a Segment, attach a pre-approved Message Template, select your channels (Email, SMS, WhatsApp), and schedule the outbound delivery. It also displays open, click, and reply analytics.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><ShieldCheck className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Consent Management</h4>
                        <p className="text-sm text-slate-600 mt-1">A highly critical compliance page. It tracks exactly who has Opted-In or Opted-Out for each specific channel. If a user is marked as Opted-Out here, the system will physically block campaigns from messaging them.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-8 animate-fade-in">
                {/* 1. What and Why (Hindi) */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                      <Target className="h-5 w-5 text-indigo-500" />
                      AlgoConnect kya hai?
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      AlgoConnect ek powerful B2B marketing aur CRM platform hai. Ise khaas taur par India ke financial professionals (jaise SEBI Research Analysts, Investment Advisors, aur NSE Sub-brokers) tak pahunchne ke liye banaya gaya hai. Ye system market se unka data collect karta hai, unki details verify karta hai, aur unhe Email, SMS, ya WhatsApp ke zariye messages bhejta hai.
                    </p>
                  </div>
                  <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                    <h2 className="text-lg font-bold text-[#0F172A] mb-3 flex items-center gap-2">
                      <Zap className="h-5 w-5 text-amber-500" />
                      Ye system kyu banaya gaya?
                    </h2>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      Financial market me naye clients dhundhna bahut mushkil aur strict compliance (rules) wala kaam hai. AlgoConnect isliye banaya gaya taaki leads ikattha karne ka kaam automatic ho jaye, fake/inactive leads hat jaye, aur system khud ba khud rules follow karte hue bulk me campaigns chala sake, jisse Sales Team ko sirf qualified (warm) leads mile.
                    </p>
                  </div>
                </div>

                {/* 2. Roles in the App (Hindi) */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2 border-b border-[#E2E8F0] pb-4">
                    <Users className="h-5 w-5 text-emerald-500" />
                    User Roles & Permissions (Kon kya kar sakta hai)
                  </h2>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div className="p-4 rounded-lg bg-blue-50/50 border border-blue-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Shield className="h-5 w-5 text-blue-600" />
                        <h3 className="font-bold text-blue-900">System Admin</h3>
                      </div>
                      <p className="text-sm text-blue-800/80 leading-relaxed">
                        Inke paas poore system ka full control hota hai. Naye users banana, API settings configure karna, aur message bhejne wale gateways (Email/SMS Providers) ko system ke sath connect karna inhi ka kaam hai.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-purple-50/50 border border-purple-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Megaphone className="h-5 w-5 text-purple-600" />
                        <h3 className="font-bold text-purple-900">Growth Operator</h3>
                      </div>
                      <p className="text-sm text-purple-800/80 leading-relaxed">
                        Ye main Marketing team hote hain. Ye bahar se leads import karte hain, unhe alag-alag Segments (groups) me baant'te hain, aur un par Campaigns chalate hain.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-amber-50/50 border border-amber-100">
                      <div className="flex items-center gap-2 mb-2">
                        <ShieldCheck className="h-5 w-5 text-amber-600" />
                        <h3 className="font-bold text-amber-900">Compliance Admin</h3>
                      </div>
                      <p className="text-sm text-amber-800/80 leading-relaxed">
                        Inka kaam ye dekhna hai ki koi rule na toote. Ye check karte hain ki Message Templates TRAI/DLT rules ke hisaab se sahi hain ya nahi. Agar koi customer "Do Not Contact" bolta hai, toh ye unhe block list (Opt-Out) me daalte hain.
                      </p>
                    </div>
                    <div className="p-4 rounded-lg bg-emerald-50/50 border border-emerald-100">
                      <div className="flex items-center gap-2 mb-2">
                        <Briefcase className="h-5 w-5 text-emerald-600" />
                        <h3 className="font-bold text-emerald-900">Sales Rep</h3>
                      </div>
                      <p className="text-sm text-emerald-800/80 leading-relaxed">
                        Sales Team ko sirf un leads ka data dikhta hai jinhone campaign emails/SMS khol kar dekhe hain ya interest show kiya hai. Ye direct customer ko call karke deal close karte hain.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 3. Page Dictionary (Hindi) */}
                <div className="rounded-xl border border-[#E2E8F0] bg-white p-6 shadow-sm">
                  <h2 className="text-lg font-bold text-[#0F172A] mb-6 flex items-center gap-2 border-b border-[#E2E8F0] pb-4">
                    <BookOpen className="h-5 w-5 text-primary" />
                    Page Dictionary & Workflows (Kaunsa page kya karta hai)
                  </h2>
                  <div className="space-y-6">
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><Database className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Lead Management (Leads Page)</h4>
                        <p className="text-sm text-slate-600 mt-1">Ye poore system ka main Database hai. Yaha aap raw data (Excel/CSV) upload kar sakte hain, unka verification kar sakte hain, aur kisi bhi ek lead ki poori details aur history dekh sakte hain.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><Target className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Segments (Groups)</h4>
                        <p className="text-sm text-slate-600 mt-1">Ek sath 10,000 logo ko message bhejne ke bajaye, aap yaha smart filters banate hain. Jaise "Sirf Maharashtra ke log". Inhi Segments par aage chalkar Campaign chalaya jata hai.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><Megaphone className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Campaigns</h4>
                        <p className="text-sm text-slate-600 mt-1">Ye execution engine hai. Yaha aap ek Segment select karte hain, Message Template set karte hain, aur system ko Email/WhatsApp bhejne ka order dete hain. Yahi par aapko statistics (Kitne open hue, kitne fail hue) dikhte hain.</p>
                      </div>
                    </div>
                    <div className="flex gap-4">
                      <div className="flex-shrink-0 mt-1"><ShieldCheck className="h-5 w-5 text-slate-400" /></div>
                      <div>
                        <h4 className="text-sm font-bold text-[#0F172A]">Consent Management</h4>
                        <p className="text-sm text-slate-600 mt-1">Ye ek security page hai. Yaha record hota hai ki kis customer ko message bhejna allow hai (Opt-in) aur kisne mana kiya hai (Opt-out). System automatically Opt-out walo ko message bhejna band kar deta hai.</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: Status Definitions */}
        {activeTab === 'status' && (
          <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-2 duration-300">
            <div className="flex justify-end">
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search status or meaning..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 shadow-sm"
                />
              </div>
            </div>

            <div className="space-y-10">
              {categories.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200 shadow-sm">
                  <BookOpen className="h-10 w-10 mb-3 text-slate-300" />
                  <p className="text-sm font-bold text-slate-600">No definitions found for "{search}"</p>
                </div>
              ) : (
                categories.map(category => (
                  <div key={category} className="space-y-4">
                    <h2 className="text-lg font-bold text-slate-800 border-b pb-2 flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                      {category} Statuses
                    </h2>
                    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {filteredStatuses.filter(s => s.category === category).map((status, index) => (
                        <div key={index} className="group flex flex-col rounded-xl border border-slate-200 bg-white p-5 shadow-sm transition-all hover:shadow-md hover:border-blue-200">
                          <div className="mb-4">
                            <span className="inline-block rounded-md bg-slate-100 px-2.5 py-1 text-sm font-bold text-slate-800 group-hover:bg-blue-50 group-hover:text-blue-700 transition-colors">
                              {status.name}
                            </span>
                          </div>
                          <div className="flex-1 space-y-4">
                            <div>
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">English Meaning</p>
                              <p className="text-sm font-medium text-slate-700 leading-relaxed">{status.englishMeaning}</p>
                            </div>
                            <div className="pt-3 border-t border-slate-100">
                              <p className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 mb-1">Hindi Meaning (हिंदी में मतलब)</p>
                              <p className="text-sm font-medium text-slate-800 leading-relaxed font-sans">{status.hindiMeaning}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
