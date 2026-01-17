"use client";

import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useEffect, useRef, useState } from "react";

if (typeof window !== "undefined") {
  gsap.registerPlugin(ScrollTrigger);
}

const faqs = [
  {
    question: "What makes Pulsewave different from other agencies?",
    answer: "We blend strategic thinking with bold creativity. Unlike traditional agencies, we're a tight-knit team of designers and developers who obsess over every pixel. We don't just deliver projects—we partner with you to create digital experiences that truly move the needle.",
  },
  {
    question: "How long does a typical project take?",
    answer: "Most projects range from 6-12 weeks depending on scope. A brand identity might take 4-6 weeks, while a full website redesign with development typically runs 8-12 weeks. We'll provide a detailed timeline during our initial consultation.",
  },
  {
    question: "Do you work with startups or only established brands?",
    answer: "We love working with both. Startups bring fresh energy and the chance to build something from scratch. Established brands offer the challenge of evolving while honoring legacy. Whether you're pre-seed or Series C, we adapt our process to fit your stage and budget.",
  },
  {
    question: "Can you help with ongoing design and development needs?",
    answer: "Absolutely. Many clients start with a project and transition to a retainer model. Our monthly partnerships include dedicated hours for design updates, new features, A/B testing, and strategic consultation. It's like having an in-house creative team on call.",
  },
  {
    question: "What's your design and development process like?",
    answer: "We follow a proven four-phase approach: Discovery (research & strategy), Design (wireframes to high-fidelity), Development (clean, scalable code), and Launch (testing & optimization). You're involved at every milestone with clear deliverables and feedback loops.",
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
        {/* Title */}
        <h2
          ref={titleRef}
          className="text-4xl lg:text-5xl font-medium tracking-tight text-foreground text-center mb-12 lg:mb-16"
        >
          Frequently Asked
          <br />
          Questions
        </h2>

        {/* FAQ Items */}
        <div className="flex flex-col gap-4">
          {faqs.map((faq, index) => (
            <FaqItem key={index} question={faq.question} answer={faq.answer} index={index} />
          ))}
        </div>
      </div>
    </section>
  );
}
