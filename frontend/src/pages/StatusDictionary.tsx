import React, { useState } from 'react';
import { BookOpen, Search } from 'lucide-react';

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
  { name: 'Not Engaged', category: 'Engagement', englishMeaning: 'No interactions recorded yet.', hindiMeaning: 'अभी तक कोई इंटरेक्शन (बातचीत/क्लिक) रिकॉर्ड नहीं हुआ है।' },
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
  const [search, setSearch] = useState('');

  const filteredStatuses = statusDefinitions.filter(status => 
    status.name.toLowerCase().includes(search.toLowerCase()) || 
    status.category.toLowerCase().includes(search.toLowerCase()) ||
    status.englishMeaning.toLowerCase().includes(search.toLowerCase()) ||
    status.hindiMeaning.includes(search)
  );

  const categories = Array.from(new Set(filteredStatuses.map(s => s.category)));

  return (
    <div className="mx-auto max-w-6xl p-6">
      <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
              <BookOpen className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight text-[#0F172A]">
                Status Dictionary
              </h1>
              <p className="mt-1 text-sm font-medium text-[#64748B]">
                Understand what each lead status means in English and Hindi.
              </p>
            </div>
          </div>
        </div>
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search status or meaning..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-10 w-full rounded-lg border border-slate-200 bg-white pl-10 pr-4 text-sm font-medium text-slate-700 outline-none transition-all focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10"
          />
        </div>
      </div>

      <div className="space-y-10">
        {categories.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400 bg-white rounded-2xl border border-slate-200">
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
  );
}
