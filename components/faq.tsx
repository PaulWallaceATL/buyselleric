"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";
import { siteConfig } from "@/lib/config";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const faqs = [
  {
    question: "How does the buying process work with Eric?",
    answer:
      "You will start with a short conversation about budget, neighborhoods, and timing. From there, Eric helps you prioritize homes, craft competitive offers when it matters, and stay ahead of deadlines through inspection, appraisal, and closing.",
  },
  {
    question: "What should I do before listing my home?",
    answer:
      "Small repairs, decluttering, and professional photography often deliver the best return. Eric will walk your property, suggest a pricing range backed by comps, and outline a marketing plan—so you know what to tackle first.",
  },
  {
    question: "Do you work with out-of-area buyers or sellers?",
    answer:
      "Yes. Many clients relocate for work or family. Eric can coordinate virtual tours, digital signings where allowed, and introductions to trusted local vendors so distance does not slow you down.",
  },
  {
    question: "How are commissions structured?",
    answer:
      "Compensation is discussed upfront and documented in your representation agreement. Eric is transparent about how buyer and seller fees work in your market so there are no surprises at the closing table.",
  },
  {
    question: "How quickly can I see new listings?",
    answer:
      "Published homes on this site update as soon as they are added in the admin panel. For off-market or coming-soon opportunities, reach out directly—Eric often knows what is coming before it hits the broader market.",
  },
];

function FaqItem({ question, answer, index }: { question: string; answer: string; index: number }) {
  const [isOpen, setIsOpen] = useState(false);
  const itemRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!itemRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        itemRef.current,
        { y: 40, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.6,
          ease: "power3.out",
          scrollTrigger: {
            trigger: itemRef.current,
            start: "top 90%",
            end: "top 70%",
            scrub: 1,
          },
        }
      );
    }, itemRef);

    return () => ctx.revert();
  }, [index]);

  return (
    <div
      ref={itemRef}
      className="border border-foreground/10 rounded-2xl overflow-hidden"
    >
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-6 text-left cursor-pointer"
      >
        <span className="text-lg font-medium text-foreground pr-4">{question}</span>
        <span
          className="relative w-6 h-6 shrink-0 text-foreground transition-transform duration-300"
          style={{ transform: isOpen ? "rotate(45deg)" : "rotate(0deg)" }}
        >
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-4 h-[1.5px] bg-current" />
          <span className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[1.5px] h-4 bg-current" />
        </span>
      </button>
      <div
        className="grid transition-all duration-300 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <p className="px-6 pb-6 text-foreground/70 leading-relaxed">{answer}</p>
        </div>
      </div>
    </div>
  );
}

export function Faq() {
  const sectionRef = useRef<HTMLElement>(null);
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    if (!sectionRef.current) return;

    const ctx = gsap.context(() => {
      gsap.fromTo(
        titleRef.current,
        { y: 60, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 1,
          ease: "power3.out",
          scrollTrigger: {
            trigger: sectionRef.current,
            start: "top 75%",
            end: "top 50%",
            scrub: 1,
          },
        }
      );
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-background py-24 lg:py-32">
      <div className="px-6 sm:px-12 lg:px-24 max-w-4xl mx-auto">
        <h2
          ref={titleRef}
          className="text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-center mb-4 lg:mb-6"
        >
          Questions
          <br />
          buyers & sellers ask
        </h2>
        <p className="text-center text-muted-foreground mb-12 lg:mb-16 max-w-xl mx-auto">
          Straight answers from {siteConfig.agentName}. Reach out anytime if you do not see yours
          here.
        </p>

        <div className="flex flex-col gap-4">
          {faqs.map((faqItem, index) => (
            <FaqItem
              key={index}
              question={faqItem.question}
              answer={faqItem.answer}
              index={index}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
