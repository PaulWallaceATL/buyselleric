import { siteConfig } from "@/lib/config";

export interface ServiceFeature {
  title: string;
  description: string;
}

export interface ServiceFaq {
  question: string;
  answer: string;
}

export interface ServicePage {
  slug: string;
  title: string;
  headline: string;
  description: string;
  intro: string;
  features: ServiceFeature[];
  faqs: ServiceFaq[];
  ctaText: string;
  ctaHref: string;
}

const agent = siteConfig.agentName;

export const servicesData: Record<string, ServicePage> = {
  "buyer-representation": {
    slug: "buyer-representation",
    title: "Buyer Representation",
    headline: "Find the right home with a dedicated advocate in your corner.",
    description: `${agent} provides full-service buyer representation across metro Atlanta—from first tour to closing table.`,
    intro: `Buying a home is one of the largest financial decisions you will make. ${agent} works exclusively on your behalf to find properties that match your criteria, negotiate the best possible terms, and guide you through every step from offer to keys. Whether you are a first-time buyer or an experienced investor, you get the same hands-on, transparent service.`,
    features: [
      {
        title: "Personalized property search",
        description:
          "Access to MLS listings, off-market opportunities, and coming-soon properties filtered to your budget, neighborhood preferences, and must-haves.",
      },
      {
        title: "Tour scheduling & strategy",
        description:
          "Coordinated showings on your timeline with detailed notes on each property so you can compare with confidence—not pressure.",
      },
      {
        title: "Market analysis for every offer",
        description:
          "Comparable sales data, days-on-market trends, and pricing context so your offer is competitive without overpaying.",
      },
      {
        title: "Offer writing & negotiation",
        description:
          "Strategically structured offers with escalation clauses, inspection contingencies, and closing-cost credits tailored to your situation.",
      },
      {
        title: "Inspection & appraisal guidance",
        description:
          "Review of inspection reports, negotiation of repairs or credits, and coordination with appraisers to keep the deal on track.",
      },
      {
        title: "Closing coordination",
        description:
          "Communication with lenders, title companies, and attorneys so deadlines are met and your closing day is smooth.",
      },
    ],
    faqs: [
      {
        question: "Do I pay the buyer's agent fee?",
        answer:
          "Buyer agent compensation is discussed and documented in your representation agreement before we begin. Eric is transparent about how fees work in your transaction so there are no surprises at closing.",
      },
      {
        question: "How quickly can I start seeing homes?",
        answer:
          "Once we have a brief consultation about your budget and goals, showings can typically begin the same week. Pre-approval from a lender speeds the process.",
      },
      {
        question: "Do you work with first-time buyers?",
        answer:
          "Absolutely. A significant portion of Eric's clients are first-time buyers. You will get extra time explaining each step, down-payment assistance options, and introductions to trusted lenders.",
      },
    ],
    ctaText: "Start your home search",
    ctaHref: "/listings",
  },

  "seller-marketing": {
    slug: "seller-marketing",
    title: "Seller Marketing & Prep",
    headline: "Position your home to sell faster and for more.",
    description: `${agent} delivers a full marketing and preparation strategy so your home stands out from day one on the market.`,
    intro: `Selling a home is about more than listing it—it is about presenting it to the right audience at the right price with the right story. ${agent} builds a custom marketing plan for every seller that combines staging guidance, professional photography, targeted digital marketing, and MLS exposure to generate qualified interest quickly.`,
    features: [
      {
        title: "Pre-listing home assessment",
        description:
          "A walkthrough of your property with room-by-room recommendations on repairs, decluttering, and improvements that yield the best return on investment.",
      },
      {
        title: "Professional photography & media",
        description:
          "High-resolution photos, virtual tours, and drone footage when appropriate so your listing makes a strong first impression online.",
      },
      {
        title: "Staging consultation",
        description:
          "Guidance on furniture arrangement, lighting, and curb appeal—or full staging coordination with trusted local partners.",
      },
      {
        title: "MLS & syndication exposure",
        description:
          "Your listing distributed across the MLS, Zillow, Realtor.com, Redfin, and hundreds of partner sites within hours of going live.",
      },
      {
        title: "Targeted digital marketing",
        description:
          "Social media campaigns, email blasts to buyer agents, and geo-targeted ads that put your home in front of active, qualified buyers.",
      },
      {
        title: "Open house management",
        description:
          "Professionally hosted open houses with follow-up to every attendee, collecting feedback and gauging buyer interest in real time.",
      },
    ],
    faqs: [
      {
        question: "How long does the prep process take?",
        answer:
          "Most homes are market-ready in one to three weeks depending on the scope of prep work. Eric creates a timeline during the initial walkthrough so you know exactly what to expect.",
      },
      {
        question: "Do I need to stage my home?",
        answer:
          "Not always. Some homes photograph and show beautifully as-is. Eric will give you an honest assessment of whether staging or light touch-ups will make a meaningful difference in your sale price.",
      },
      {
        question: "What does your marketing plan include?",
        answer:
          "Every seller receives professional photography, MLS distribution, social media promotion, and a custom property website. Additional services like drone video or print mailers are added based on the property and price point.",
      },
    ],
    ctaText: "Get a free home evaluation",
    ctaHref: "/sell",
  },

  "pricing-negotiation": {
    slug: "pricing-negotiation",
    title: "Pricing & Negotiation",
    headline: "Data-backed pricing. Disciplined negotiation. Better outcomes.",
    description: `${agent} uses market data and negotiation expertise to ensure you buy or sell at the right price—not just any price.`,
    intro: `Price is the single most important factor in any real estate transaction. Too high and your listing sits; too low and you leave money on the table. On the buying side, overpaying in a competitive market can take years to recover. ${agent} combines local comparable data, market trend analysis, and years of negotiation experience to land on the number that works—for both your timeline and your bottom line.`,
    features: [
      {
        title: "Comparative market analysis",
        description:
          "Detailed CMA reports using recent sales, pending transactions, and active competition to establish a data-driven price range.",
      },
      {
        title: "Pricing strategy sessions",
        description:
          "One-on-one conversations about market positioning—should you price at market, slightly below to generate multiple offers, or hold firm? Eric walks through the trade-offs.",
      },
      {
        title: "Multi-offer management",
        description:
          "When multiple offers arrive, Eric organizes, compares, and advises on terms, contingencies, and escalation strategies—not just the highest number.",
      },
      {
        title: "Counteroffer strategy",
        description:
          "Crafting responses that protect your interests while keeping the deal alive. Every counter is a negotiation move, not just a number adjustment.",
      },
      {
        title: "Repair & credit negotiation",
        description:
          "After inspections, Eric negotiates repairs or seller credits based on what is reasonable, what is cosmetic, and what is deal-critical.",
      },
      {
        title: "Appraisal gap guidance",
        description:
          "If the home appraises below the contract price, Eric helps navigate renegotiation, gap coverage, or alternative solutions to keep the deal together.",
      },
    ],
    faqs: [
      {
        question: "How do you determine the right list price?",
        answer:
          "Eric prepares a comparative market analysis looking at recent sales of similar homes in your neighborhood, current active listings, and market trends. The recommended range is presented with data so you can make an informed decision.",
      },
      {
        question: "What if I get multiple offers?",
        answer:
          "Eric will organize every offer into a clear comparison—price, financing, contingencies, closing timeline—and advise on which terms give you the strongest outcome, not just the highest dollar figure.",
      },
      {
        question: "Can you help if the appraisal comes in low?",
        answer:
          "Yes. Eric has experience navigating appraisal gaps through renegotiation, providing additional comparable data to the appraiser, or structuring creative solutions between buyer and seller.",
      },
    ],
    ctaText: "Talk pricing strategy",
    ctaHref: "/#contact",
  },

  "closing-coordination": {
    slug: "closing-coordination",
    title: "Closing Coordination",
    headline: "From contract to keys—every deadline handled.",
    description: `${agent} manages every detail between accepted offer and closing day so nothing falls through the cracks.`,
    intro: `The period between a signed contract and closing day is where deals can fall apart—missed deadlines, miscommunication between lenders and attorneys, inspection surprises, or title issues. ${agent} acts as the central point of contact, coordinating between all parties and keeping every task on schedule so you can close with confidence and without last-minute chaos.`,
    features: [
      {
        title: "Transaction timeline management",
        description:
          "A clear schedule of every milestone—inspection, appraisal, loan commitment, title review, final walkthrough—with proactive reminders so nothing is missed.",
      },
      {
        title: "Lender & title coordination",
        description:
          "Direct communication with your lender, title company, and closing attorney to ensure documents, conditions, and funds are aligned before closing day.",
      },
      {
        title: "Inspection follow-through",
        description:
          "Scheduling inspections, reviewing reports, negotiating repairs or credits, and confirming completed work before the contingency deadline.",
      },
      {
        title: "Document review",
        description:
          "Reviewing closing disclosures, settlement statements, and contract amendments so you understand every line item before you sign.",
      },
      {
        title: "Final walkthrough coordination",
        description:
          "Scheduling and attending the final walkthrough to verify the property condition matches the contract terms and any agreed-upon repairs are complete.",
      },
      {
        title: "Closing day support",
        description:
          "Eric attends closing to answer questions, verify documents, and ensure a smooth handoff of keys and possession.",
      },
    ],
    faqs: [
      {
        question: "How long does closing usually take?",
        answer:
          "In Georgia, most residential closings take 30 to 45 days from accepted offer. Cash transactions can close in as few as 14 days. Eric will outline your specific timeline at contract signing.",
      },
      {
        question: "What happens if there is a title issue?",
        answer:
          "Title issues—like liens, boundary disputes, or missing documents—are more common than most people think. Eric coordinates with the title company and attorneys to resolve them before they delay closing.",
      },
      {
        question: "Will you be at the closing?",
        answer:
          "Yes. Eric attends every closing to review documents with you, answer questions from any party, and make sure everything is in order before you sign.",
      },
    ],
    ctaText: "Get started today",
    ctaHref: "/#contact",
  },
};

export const servicesSlugs = Object.keys(servicesData);
