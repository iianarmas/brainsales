export type NodeType =
  | "opening"
  | "discovery"
  | "pitch"
  | "objection"
  | "close"
  | "success"
  | "end";

export interface Response {
  label: string;
  nextNode: string;
  note?: string;
}

export interface CallNode {
  id: string;
  type: NodeType;
  title: string;
  script: string;
  context?: string;
  keyPoints?: string[];
  warnings?: string[];
  listenFor?: string[];
  responses: Response[];
  topic_group_id?: string | null;
  metadata?: {
    competitorInfo?: string;
    greenFlags?: string[];
    redFlags?: string[];
    outcome?: "meeting_set" | "follow_up" | "send_info" | "not_interested" | null;
    meetingSubject?: string;
    meetingBody?: string;
    ehr?: string;
    dms?: string;
    competitors?: string[];
  };
}


export const callFlow: Record<string, CallNode> = {
  // ===== OPENING =====
  opening_general: {
    id: "opening_general",
    type: "opening",
    title: "Opening Script",
    script: `Hi [Name], [First] from 314e Corporation.

Quick question: when patient documents come in, how much is your team handling manually versus the system doing it automatically for you?`,
    context: "This is a pattern interrupt. Most prospects expect a pitch; instead, you're asking about THEIR process. Stay curious, not sales-y.",
    keyPoints: [
      "Sound curious, not sales-y",
      "Pause after the question - let them answer",
      "Don't rush through this"
    ],
    listenFor: [
      "Volume indicators (how many documents)",
      "Pain indicators (frustration, time spent)",
      "Current systems mentioned",
      "Team size clues"
    ],
    responses: [
      {
        label: "Mostly Manual / A Lot",
        nextNode: "disc_mostly_manual",
        note: "This is the ideal response - they have clear pain"
      },
      {
        label: "Some Is Automated",
        nextNode: "disc_some_automated",
        note: "They have partial automation - dig deeper"
      },
      {
        label: "It's All Automated / We're Fine",
        nextNode: "disc_all_automated",
        note: "Challenge this gently - most aren't truly automated"
      }
    ]
  },

  // ===== RESPONSE PATHS =====
  disc_mostly_manual: {
    id: "disc_mostly_manual",
    type: "discovery",
    title: "Response Path 1: Mostly Manual",
    script: `Yeah, I hear that constantly. What's eating up most of the time - classification, patient matching, or the indexing piece?`,
    context: "You're narrowing down their specific pain point. This helps customize your pitch later.",
    keyPoints: [
      "Listen for specific pain points",
      "Capture volume if mentioned"
    ],
    responses: [
      {
        label: "They elaborate on pain points",
        nextNode: "disc_ehr_followup",
        note: "Proceed to EHR discovery"
      }
    ]
  },

  disc_ehr_followup: {
    id: "disc_ehr_followup",
    type: "discovery",
    title: "Follow-up: Get EHR Info",
    script: `Right, and with [X] documents a day, that adds up.

What system are you using - Epic, Cerner, something else?`,
    context: "Transition to understanding their tech stack.",
    responses: [
      {
        label: "Epic",
        nextNode: "disc_ehr_epic",
        note: "Most common - check for OnBase or Gallery"
      },
      {
        label: "Cerner",
        nextNode: "disc_ehr_other",
        note: "Non-Epic EHR"
      },
      {
        label: "Meditech",
        nextNode: "disc_ehr_other",
        note: "Non-Epic EHR"
      },
      {
        label: "Other EHR",
        nextNode: "disc_ehr_other_than",
        note: "Non-Epic EHR"
      }
    ]
  },

  disc_some_automated: {
    id: "disc_some_automated",
    type: "discovery",
    title: "Response Path 2: Some Is Automated",
    script: `Okay, good. What parts ARE automated, and what's still manual for your team?`,
    context: "Need to understand what's automated vs. manual",
    listenFor: [
      "What's actually automated (often just routing)",
      "What's still manual (usually classification/indexing)",
      "Satisfaction level with current automation"
    ],
    responses: [
      {
        label: "They explain their process",
        nextNode: "disc_dms_followup",
        note: "Dig into DMS"
      }
    ]
  },

  disc_dms_followup: {
    id: "disc_dms_followup",
    type: "discovery",
    title: "Follow-up: Get DMS Info",
    script: `Got it. So you've got some automation, but there's still manual work happening.

What system are you using for that - OnBase, something else?`,
    responses: [
      {
        label: "OnBase",
        nextNode: "disc_onbase",
        note: "Most common DMS"
      },
      {
        label: "Epic Gallery",
        nextNode: "disc_gallery",
        note: "Epic's newer solution"
      },
      {
        label: "Solarity",
        nextNode: "disc_other_dms",
        note: "Independent healthcare IDP"
      },
      {
        label: "Vyne",
        nextNode: "disc_other_dms",
        note: "Referral-focused"
      },
      {
        label: "Other DMS",
        nextNode: "disc_other_dms",
        note: "Unknown competitor"
      },
      {
        label: "No separate DMS",
        nextNode: "disc_ehr_only",
        note: "Just using EHR"
      }
    ]
  },

  disc_all_automated: {
    id: "disc_all_automated",
    type: "discovery",
    title: "Response Path 3: All Automated",
    script: `That's impressive - you're ahead of most HIM departments.

Just curious, what are you using that's handling everything automatically?`,
    context: "This is usually not true; probe gently. You're complimenting them while gently challenging. Most will clarify 'well, not EVERYTHING...'",
    responses: [
      {
        label: "They name a system",
        nextNode: "disc_automation_challenge",
        note: "Challenge the claim gently"
      },
      {
        label: "They admit it's not fully automated",
        nextNode: "disc_some_automated",
        note: "Go back to partial automation path"
      }
    ]
  },

  disc_automation_challenge: {
    id: "disc_automation_challenge",
    type: "discovery",
    title: "[Other DMS] Challenge: True Automation?",
    script: `Interesting. So [OnBase/Solarity/whatever] is automatically classifying documents, matching to patients, and indexing without anyone touching them?`,
    context: "Expected: They'll usually admit 'Well, not exactly...' or 'Someone still needs to verify...'",
    responses: [
      {
        label: "\"Well, not exactly...\" / \"Someone still verifies\"",
        nextNode: "pitch_automation_pivot",
        note: "They admitted the gap"
      },
      {
        label: "\"Yes, it's fully automated\"",
        nextNode: "end_satisfied_customer",
        note: "Rare - they may be truly satisfied"
      }
    ]
  },

  pitch_automation_pivot: {
    id: "pitch_automation_pivot",
    type: "pitch",
    title: "Pivot to Value Proposition",
    script: `Right - that's what I thought. Most systems need someone to at least verify or correct things.

That's actually the gap we fill. Want me to explain?`,
    responses: [
      {
        label: "Yes, tell me more",
        nextNode: "pitch_full",
        note: "They're interested!"
      },
      {
        label: "Not interested",
        nextNode: "obj_not_interested",
        note: "Handle objection"
      }
    ]
  },

  // ===== EHR DISCOVERY =====
  disc_ehr_epic: {
    id: "disc_ehr_epic",
    type: "discovery",
    title: "EHR: Epic",
    script: `Epic, okay. And for document management - are you using OnBase, Epic Gallery, or just Epic's basic document storage?`,
    context: "Epic customers often use OnBase, may be considering Gallery, or struggling with Epic alone.",
    responses: [
      {
        label: "OnBase",
        nextNode: "disc_onbase",
        note: "Most common scenario for large Epic customers"
      },
      {
        label: "Epic Gallery / Moving to Gallery",
        nextNode: "disc_gallery",
        note: "Epic is pushing Gallery - opportunity to position against it"
      },
      {
        label: "Other DMS (Solarity/ Vyne / Other DMS)",
        nextNode: "disc_other_dms",
        note: "Need to probe capabilities and satisfaction"
      },
      {
        label: "Just Epic (no DMS)",
        nextNode: "disc_epic_only",
        note: "Often smaller organizations or those struggling with gaps"
      }
    ]
  },

  disc_ehr_other: {
    id: "disc_ehr_other",
    type: "discovery",
    title: "EHR: Cerner/Meditech/Other",
    script: `[Cerner/Meditech], got it. And for document management - are you using OnBase, or something else?`,
    context: "Non-Epic EHRs less likely to have Gallery pressure, but still often use OnBase.",
    responses: [
      {
        label: "OnBase",
        nextNode: "disc_onbase",
        note: "OnBase is EHR-agnostic, used across all EHRs"
      },
      {
        label: "Solarity / Vyne / Other DMS",
        nextNode: "disc_other_dms",
        note: "Need to probe capabilities and satisfaction"
      },
      {
        label: "Nothing separate, just the EHR",
        nextNode: "disc_ehr_only",
        note: "Good opportunity - no incumbent DMS to displace"
      }
    ]
  },

  disc_ehr_other_than: {
    id: "disc_ehr_other_than",
    type: "discovery",
    title: "EHR: AllScripts/WellSky/Other",
    script: `[AllScripts/WellSky/Other], got it. And for document management - are you using OnBase, or something else?`,
    context: "Non-Epic EHRs less likely to have Gallery pressure, but still often use OnBase.",
    responses: [
      {
        label: "OnBase",
        nextNode: "disc_onbase",
        note: "OnBase is EHR-agnostic, used across all EHRs"
      },
      {
        label: "Solarity / Vyne / Other DMS",
        nextNode: "disc_other_dms",
        note: "Need to probe capabilities and satisfaction"
      },
      {
        label: "Nothing separate, just the EHR",
        nextNode: "disc_ehr_only",
        note: "Good opportunity - no incumbent DMS to displace"
      }
    ]
  },

  // ===== ONBASE PATH =====
  disc_onbase: {
    id: "disc_onbase",
    type: "discovery",
    title: "OnBase Discovery",
    script: `OnBase, okay - so OnBase is handling storage and workflow.

Can I ask - does OnBase automatically figure out what documents are and who they belong to,
or does someone on your team still need to do that manually?`,
    context: "Understanding their OnBase setup is critical for positioning.",
    keyPoints: [
      "Keyword rules = basic automation, lots of manual work remains",
      "Brainware = expensive add-on, often underperforms expectations",
      "Neither = ALL manual work"
    ],
    responses: [
      {
        label: "Just basic OnBase / Keyword rules (No Automation)",
        nextNode: "pitch_onbase_basic",
        note: "Clear gap - strong opportunity"
      },
      {
        label: "We have Brainware",
        nextNode: "disc_onbase_brainware",
        note: "Competitive displacement - handle carefully"
      }
    ]
  },

  pitch_onbase_basic: {
    id: "pitch_onbase_basic",
    type: "pitch",
    title: "OnBase Basic - Clear Opportunity",
    script: `Got it. So even with OnBase in place, your team is still opening each document, figuring out what it is, matching to patients, typing in the metadata?`,
    context: "Confirm the pain point before pitching.",
    responses: [
      {
        label: "Yes, that's right",
        nextNode: "pitch_onbase",
        note: "Confirmed - deliver pitch"
      },
      {
        label: "We have some automation",
        nextNode: "disc_onbase",
        note: "Probe deeper"
      }
    ]
  },

  pitch_onbase: {
    id: "pitch_onbase",
    type: "pitch",
    title: "OnBase Pitch",
    script: `Right, that's what we're seeing everywhere. OnBase is great for storage and workflows, but it doesn't eliminate that front-end manual work. That's exactly what we solve.

Our AI - it's called DextractLM - handles all that automatically. Reads the document, classifies it, pulls patient info, matches to your MPI, indexes everything. Then it feeds into OnBase already processed.

So OnBase stays for what it's good at, but now your team isn't spending hours on manual indexing. Most HIM teams get back 70-80% of the time they were spending on this.`,
    metadata: {
      competitorInfo: "OnBase Strengths: Workflow routing, storage, enterprise-proven. Weaknesses: No AI, manual indexing required, keyword rules are brittle."
    },
    responses: [
      {
        label: "That sounds interesting",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "How much does it cost?",
        nextNode: "obj_cost",
        note: "Handle price objection"
      },
      {
        label: "We're happy with OnBase",
        nextNode: "obj_happy_current",
        note: "Handle satisfaction objection"
      }
    ]
  },

  disc_onbase_brainware: {
    id: "disc_onbase_brainware",
    type: "discovery",
    title: "OnBase + Brainware",
    script: `Brainware - so you've got Hyland's intelligent capture add-on.

How's that working for you? Happy with the accuracy?`,
    context: "Don't immediately attack Brainware. Let them tell you the problems.",
    keyPoints: [
      "Listen carefully for dissatisfaction",
      "Common complaints: accuracy, maintenance, cost, retraining"
    ],
    responses: [
      {
        label: "\"It's okay but...\" / Issues mentioned",
        nextNode: "pitch_brainware_dissatisfied",
        note: "They're dissatisfied - opportunity"
      },
      {
        label: "\"It's working well\"",
        nextNode: "disc_brainware_satisfied",
        note: "Satisfied - harder displacement"
      }
    ]
  },

  pitch_brainware_dissatisfied: {
    id: "pitch_brainware_dissatisfied",
    type: "pitch",
    title: "Brainware Issues - Pitch Dexit",
    script: `Yeah, we hear that from a lot of Brainware users. It's better than basic keyword rules, but it's complex to maintain and the accuracy isn't always there, right?

Here's the difference with Dexit: Brainware was built before the current generation of AI. Our DextractLM is a modern large language model trained specifically on healthcare documents. We're seeing 95%+ accuracy out of the box, and it learns continuously from corrections.

Plus, Brainware is expensive on top of OnBase. Dexit is subscription-based and typically costs less overall. Worth comparing to see the difference?`,
    metadata: {
      competitorInfo: "Brainware: Cost $50K-$200K+, built before modern AI, requires training and retraining, complex configuration, not healthcare-specific."
    },
    responses: [
      {
        label: "Yes, let's compare",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We just renewed our contract",
        nextNode: "obj_contract",
        note: "Handle contract objection"
      },
      {
        label: "Not interested",
        nextNode: "obj_not_interested",
        note: "Handle objection"
      }
    ]
  },

  disc_brainware_satisfied: {
    id: "disc_brainware_satisfied",
    type: "discovery",
    title: "Brainware Satisfied - Probe Deeper",
    script: `That's good to hear - you're in the minority. Most Brainware users we talk to have frustrations with it.

Just curious - what's your accuracy rate, and how much maintenance does it require?`,
    context: "They'll usually mention some issues (cost, maintenance, retraining)",
    responses: [
      {
        label: "They mention issues",
        nextNode: "pitch_brainware_satisfied",
        note: "Found an opening"
      },
      {
        label: "Truly satisfied, no issues",
        nextNode: "end_satisfied_customer",
        note: "Rare - plant seeds for future"
      }
    ]
  },

  pitch_brainware_satisfied: {
    id: "pitch_brainware_satisfied",
    type: "pitch",
    title: "Brainware - Soft Pitch",
    script: `Right. Even if it's working well, here's what might be worth looking at:

Brainware requires periodic retraining when you add new document types or formats change. Dexit learns continuously - every correction your team makes trains the AI automatically.

Also, we're typically more cost-effective than the Brainware license.

Worth a quick comparison?`,
    responses: [
      {
        label: "Sure, I'll take a look",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "Not right now",
        nextNode: "obj_timing",
        note: "Handle timing objection"
      }
    ]
  },

  // ===== EPIC GALLERY PATH =====
  disc_gallery: {
    id: "disc_gallery",
    type: "discovery",
    title: "Epic Gallery Discovery",
    script: `Gallery - okay. Are you already using it, or planning to move to it?`,
    context: "Epic is actively pushing Gallery to reduce third-party DMS usage.",
    responses: [
      {
        label: "Planning to move to Gallery",
        nextNode: "disc_gallery_planning",
        note: "Perfect opportunity - intervene before they commit"
      },
      {
        label: "Already using Gallery",
        nextNode: "disc_gallery_using",
        note: "Complementary opportunity - position as add-on"
      }
    ]
  },

  disc_gallery_planning: {
    id: "disc_gallery_planning",
    type: "discovery",
    title: "Planning Gallery Migration",
    script: `Got it. So you're looking to move from [OnBase/current system] to Epic Gallery.

Can I ask what's driving that - vendor consolidation, cost, or something else?`,
    context: "Understanding their motivation helps positioning.",
    listenFor: [
      "Epic is pushing us toward it",
      "Vendor consolidation",
      "Reduce number of systems",
      "It's included in Epic licensing",
      "Simplify our environment"
    ],
    responses: [
      {
        label: "They explain their reasoning",
        nextNode: "pitch_gallery",
        note: "Deliver Gallery positioning"
      }
    ]
  },

  pitch_gallery: {
    id: "pitch_gallery",
    type: "pitch",
    title: "Gallery Migration Pitch",
    script: `That makes sense. Here's something to consider: Gallery is good for clinical documents that are already in Epic, but it's not designed for all the external stuff - faxes from outside providers, non-clinical documents, high-volume intake.

Plus, Gallery doesn't have AI-powered automation. Someone still has to manually classify and index documents.

Here's where we can help:

First, we can assist with your data migration from [current system] to Gallery - we've done this before and can make the transition smoother.

Second, Dexit adds the AI automation that Gallery doesn't have. Documents get processed automatically - classification, patient matching, extraction - and then feed into Gallery already indexed.

And third, for non-clinical documents that Gallery can't handle - HR files, contracts, admin documents - Dexit can manage those too.

So you get the Epic consolidation you want, plus automation you won't get from Gallery alone. Make sense?`,
    metadata: {
      competitorInfo: "Gallery: No AI, manual processing required, designed for Epic clinical documents only, doesn't handle non-clinical docs, limited workflow capabilities."
    },
    responses: [
      {
        label: "That makes sense",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're waiting for Gallery features",
        nextNode: "obj_waiting_gallery",
        note: "Handle waiting objection"
      },
      {
        label: "Not interested",
        nextNode: "obj_not_interested",
        note: "Handle objection"
      }
    ]
  },

  disc_gallery_using: {
    id: "disc_gallery_using",
    type: "discovery",
    title: "Currently Using Gallery",
    script: `Okay, so you're on Gallery. How's that working for you? Is it handling everything you need?`,
    context: "They'll usually mention limitations.",
    listenFor: [
      "Still pretty new, missing some features",
      "Works okay for Epic docs, but external stuff is still manual",
      "No automation, we're still indexing everything manually",
      "Can't use it for non-clinical documents"
    ],
    responses: [
      {
        label: "They mention limitations",
        nextNode: "pitch_gallery_complement",
        note: "Position Dexit as complement"
      },
      {
        label: "It's working great",
        nextNode: "end_satisfied_customer",
        note: "Rare - plant seeds"
      }
    ]
  },

  pitch_gallery_complement: {
    id: "pitch_gallery_complement",
    type: "pitch",
    title: "Gallery Complement Pitch",
    script: `Right, Gallery is pretty new and it has some gaps. The big one is that it doesn't have AI automation - someone still has to manually process documents before they go into Gallery.

That's where Dexit fits. Our AI handles the front-end processing automatically - classification, patient matching, data extraction - and feeds into Gallery already indexed. Gallery becomes the storage and viewing layer, Dexit becomes the intelligence layer.

Plus, Dexit includes a virtual fax server, so you can eliminate physical fax machines and have faxes process automatically too.

Most organizations find Gallery works better WITH intelligent automation in front of it. Worth seeing how that would work?`,
    responses: [
      {
        label: "Yes, show me",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're committed to Epic-only",
        nextNode: "obj_vendor_consolidation",
        note: "Handle vendor consolidation objection"
      }
    ]
  },

  // ===== OTHER DMS PATH =====
  disc_other_dms: {
    id: "disc_other_dms",
    type: "discovery",
    title: "Other DMS Discovery",
    script: `[System Name] - okay. Can I ask, does that system automatically classify and index documents, or is there still manual work involved?`,
    context: "Many systems CLAIM automation but it's actually rule-based or requires heavy configuration.",
    responses: [
      {
        label: "Still manual / Some is automated",
        nextNode: "pitch_other_dms_manual",
        note: "Clear opportunity"
      },
      {
        label: "It's mostly automated",
        nextNode: "disc_other_dms_automated",
        note: "Need to probe deeper"
      }
    ]
  },

  pitch_other_dms_manual: {
    id: "pitch_other_dms_manual",
    type: "pitch",
    title: "Other DMS - Manual Work",
    script: `Right, so even with [system name] in place, there's still manual processing happening. That's the piece we automate with AI.

Our system - Dexit - uses a purpose-built healthcare AI called DextractLM. It automatically classifies documents, extracts patient information, matches to your MPI, and indexes everything. Your team only reviews maybe 10-20% that need extra attention.

We can work alongside [system name], or potentially replace it depending on what you need. Most HIM teams get back 70-80% of the time they were spending on manual indexing.

Worth seeing how this would work with your setup?`,
    responses: [
      {
        label: "Yes, let's take a look",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're happy with our current system",
        nextNode: "obj_happy_current",
        note: "Handle satisfaction objection"
      }
    ]
  },

  disc_other_dms_automated: {
    id: "disc_other_dms_automated",
    type: "discovery",
    title: "Other DMS - Claims Automation",
    script: `Okay, that's good. What's it doing automatically - classification, patient matching, data extraction?`,
    context: "Probe for specifics. Most systems are rule-based.",
    responses: [
      {
        label: "They describe automation",
        nextNode: "disc_other_dms_probe_ai",
        note: "Probe whether it's AI or rule-based"
      }
    ]
  },

  disc_other_dms_probe_ai: {
    id: "disc_other_dms_probe_ai",
    type: "discovery",
    title: "Probe: AI vs Rule-Based",
    script: `Got it. Can I ask - does it use AI, or is it more rule-based? Like, does it learn from corrections, or do you have to configure rules for each document type?`,
    responses: [
      {
        label: "It's rule-based / We configure rules",
        nextNode: "pitch_other_dms_rule_based",
        note: "Position AI advantage"
      },
      {
        label: "It has AI / Machine learning",
        nextNode: "pitch_other_dms_ai",
        note: "Position DextractLM advantage"
      }
    ]
  },

  pitch_other_dms_rule_based: {
    id: "pitch_other_dms_rule_based",
    type: "pitch",
    title: "Rule-Based System Pitch",
    script: `Right, that's the difference with Dexit. We're not rule-based - we use a modern large language model specifically trained on healthcare documents. No rules to configure, no templates to maintain.

And it learns continuously - every correction your team makes trains the AI, so accuracy improves over time for YOUR specific documents.

Plus, we include a virtual fax server with AI-powered fax routing, so inbound and outbound faxes are automated too.

Worth comparing what modern AI can do versus rule-based systems?`,
    responses: [
      {
        label: "Yes, let's compare",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're satisfied with rules",
        nextNode: "obj_happy_current",
        note: "Handle objection"
      }
    ]
  },

  pitch_other_dms_ai: {
    id: "pitch_other_dms_ai",
    type: "pitch",
    title: "Competing AI System Pitch",
    script: `Okay, so they have some AI capabilities. Can I ask - is that working well, or are there still accuracy issues or manual corrections needed?

A lot of systems have added AI features, but it's not their core competency. They're adapting general AI for healthcare.

Dexit has DextractLM - a large language model purpose-built SPECIFICALLY for healthcare documents from the ground up. We're not adapting technology - healthcare document intelligence IS what we do.

Plus, our AI learns continuously from your corrections. Most systems are more static or require periodic retraining.

Worth seeing the difference in accuracy and how much less maintenance is needed?`,
    responses: [
      {
        label: "Worth a comparison",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're happy with what we have",
        nextNode: "obj_happy_current",
        note: "Handle objection"
      }
    ]
  },

  // ===== EHR-ONLY PATHS =====
  disc_epic_only: {
    id: "disc_epic_only",
    type: "discovery",
    title: "Epic Only - No DMS",
    script: `Okay, so you're using Epic for everything - clinical records and documents.

How's that working for you when it comes to external documents - faxes, scans, outside records?`,
    context: "Smaller organizations or those trying to minimize vendors often use only Epic. They struggle with external documents.",
    listenFor: [
      "Manual work to get them into Epic",
      "Epic scanning is clunky",
      "No good way to handle high volumes",
      "External documents just sit as attachments"
    ],
    responses: [
      {
        label: "They mention pain points",
        nextNode: "pitch_epic_only",
        note: "Clear opportunity"
      },
      {
        label: "It's working fine",
        nextNode: "end_satisfied_customer",
        note: "Probe or plant seeds"
      }
    ]
  },

  pitch_epic_only: {
    id: "pitch_epic_only",
    type: "pitch",
    title: "Epic-Only Pitch",
    script: `Right, Epic is great as an EHR, but it's not really built to be a full document management system. That's why a lot of organizations add OnBase or similar.

With Dexit, you might not need a separate DMS at all. Here's what we do:

Our AI handles intelligent document processing - classification, patient matching, extraction - all automatically. We have workflow capabilities built in. And we include a virtual fax server for inbound and outbound faxes.

Everything processes automatically and feeds into Epic already indexed. So you get document management without adding OnBase-level complexity and cost.

Most organizations find this is a simpler, more cost-effective solution than adding a traditional DMS. Want to see how it would work?`,
    responses: [
      {
        label: "Yes, show me",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're looking at OnBase",
        nextNode: "obj_looking_competitor",
        note: "They're evaluating - get included"
      },
      {
        label: "We're waiting for Gallery",
        nextNode: "obj_waiting_gallery",
        note: "Handle Gallery objection"
      }
    ]
  },

  disc_ehr_only: {
    id: "disc_ehr_only",
    type: "discovery",
    title: "EHR Only - No DMS",
    script: `Okay, so you're using [Cerner/Meditech] for everything.

When external documents come in - faxes, scans, outside records - how are those being processed?`,
    responses: [
      {
        label: "Manually / Description of manual process",
        nextNode: "pitch_ehr_only",
        note: "Clear opportunity"
      },
      {
        label: "It's working fine",
        nextNode: "end_satisfied_customer",
        note: "Probe or plant seeds"
      }
    ]
  },

  pitch_ehr_only: {
    id: "pitch_ehr_only",
    type: "pitch",
    title: "EHR-Only Pitch",
    script: `Right, so that's all manual work. Here's what Dexit does:

Our AI automatically processes those external documents - classifies them, extracts patient info, matches to patients, indexes everything. Then feeds directly into [Cerner/Meditech] already processed.

We also include a virtual fax server with AI-powered routing, so faxes get processed automatically too - no more fax machines.

You keep [Cerner/Meditech] for clinical workflows, but eliminate the manual document processing work. Most HIM teams get back 70-80% of their time.

Worth seeing how this integrates with your [Cerner/Meditech] environment?`,
    responses: [
      {
        label: "Yes, let's see it",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're looking at other options",
        nextNode: "obj_looking_competitor",
        note: "Get included in evaluation"
      }
    ]
  },

  // ===== FULL PITCH =====
  pitch_full: {
    id: "pitch_full",
    type: "pitch",
    title: "Full Dexit Pitch",
    script: `Here's what makes Dexit different:

First, we have DextractLM - a large language model purpose-built for healthcare documents. It's already trained on thousands of healthcare documents, so it understands what a lab result looks like, what a referral is, how to extract clinical data. No configuration needed - it works immediately.

Second, it learns continuously. Every time your team corrects something, the AI learns from it. So accuracy improves over time for YOUR specific documents and providers.

Third, we include a virtual fax server. Inbound and outbound faxes, AI-powered routing, no more fax machines. All automated.

Fourth, we have flexible workflows you build yourself with drag-and-drop - no coding needed.

And finally, we integrate with any EHR - Epic, Cerner, Meditech, whatever you're using.

Most HIM teams see 70-80% reduction in manual processing time. Your team only reviews the 10-20% that actually need human judgment. Everything else just processes itself.

Worth seeing how this would work in your environment?`,
    keyPoints: [
      "DextractLM™ - Purpose-built healthcare LLM",
      "Continuous Learning - Improves with every correction",
      "Virtual Fax Server - Built-in, AI-powered",
      "Flexible Workflows - Drag-and-drop, no coding",
      "EHR Agnostic - Works with any system",
      "70-80% Time Savings - Only 10-20% need human review"
    ],
    responses: [
      {
        label: "Yes, let's schedule a demo",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "How much does it cost?",
        nextNode: "obj_cost",
        note: "Handle price objection"
      },
      {
        label: "Send me information",
        nextNode: "obj_send_info",
        note: "Handle info request"
      },
      {
        label: "Not interested",
        nextNode: "obj_not_interested",
        note: "Handle objection"
      }
    ]
  },

  // ===== THE ASK =====
  close_ask_main: {
    id: "close_ask_main",
    type: "close",
    title: "The Ask - Request Meeting",
    script: `Let me connect you with one of our specialists who can show you exactly how this works with your [Epic/Cerner/Meditech] and [OnBase/Gallery/current setup].

Usually takes about 20 minutes.

What does your schedule look like - this week or next?`,
    context: "This is where you convert interest into a scheduled demo. Be clear, confident, and give options.",
    keyPoints: [
      "Specific - '20 minutes' (not vague 'quick call')",
      "Customized - References their specific systems",
      "Options - This week or next (assumptive close)",
      "Not pushy - Consultative tone"
    ],
    responses: [
      {
        label: "They give availability",
        nextNode: "success_meeting_set",
        note: "Success! Book the meeting"
      },
      {
        label: "They hesitate",
        nextNode: "close_ask_soft",
        note: "Lower pressure"
      },
      {
        label: "Not interested",
        nextNode: "obj_not_interested",
        note: "Handle objection"
      },
      {
        label: "Send me information first",
        nextNode: "obj_send_info",
        note: "Handle info request"
      },
      {
        label: "I'm not the decision maker",
        nextNode: "obj_not_decision_maker",
        note: "Handle decision maker objection"
      },
      {
        label: "How much does it cost?",
        nextNode: "obj_cost",
        note: "Handle price objection"
      }
    ]
  },

  close_ask_soft: {
    id: "close_ask_soft",
    type: "close",
    title: "Soft Close - Lower Pressure",
    script: `No pressure - just a quick look at what's possible. If it's a fit, great. If not, you at least see what modern document processing with AI looks like.

Twenty minutes - fair?`,
    context: "Removes pressure, educational angle, low commitment.",
    responses: [
      {
        label: "Okay, let's do it",
        nextNode: "success_meeting_set",
        note: "Success!"
      },
      {
        label: "Still hesitant",
        nextNode: "obj_not_interested",
        note: "Handle objection"
      }
    ]
  },

  success_meeting_set: {
    id: "success_meeting_set",
    type: "success",
    title: "Meeting Set - Success!",
    script: `Perfect. I'll send you a calendar invite for [day/time] to [their email].

You'll meet with [SME name] and they'll show you exactly how the AI processes documents in your environment. If it makes sense to include anyone else from your team - maybe IT or your director - feel free to add them.

Sound good?`,
    context: "Confirm details and end professionally.",
    keyPoints: [
      "Get email confirmation",
      "Confirm date/time",
      "Note their name correctly",
      "Thank them",
      "End call professionally"
    ],
    responses: [
      {
        label: "Complete call - Meeting scheduled",
        nextNode: "success_call_end",
        note: "Mark as success in CRM"
      }
    ]
  },

  // ===== OBJECTION HANDLING =====
  obj_not_interested: {
    id: "obj_not_interested",
    type: "objection",
    title: "Objection: Not Interested",
    script: `No problem. Can I ask - is it that you're happy with how things work now, or just not the right time?`,
    context: "Understanding the real reason helps. Uncovering whether it's a process issue or timing issue changes your response.",
    responses: [
      {
        label: "Just not the right time / Too busy",
        nextNode: "obj_timing",
        note: "Timing objection"
      },
      {
        label: "We're happy with current process",
        nextNode: "obj_happy_current",
        note: "Challenge gently"
      },
      {
        label: "Hard no - not interested",
        nextNode: "end_call_no",
        note: "End call politely"
      }
    ]
  },

  obj_timing: {
    id: "obj_timing",
    type: "objection",
    title: "Objection: Bad Timing",
    script: `Fair enough. When would make more sense - couple months from now?`,
    responses: [
      {
        label: "They give a timeframe",
        nextNode: "close_timing_followup",
        note: "Set follow-up"
      },
      {
        label: "Not sure / Don't call back",
        nextNode: "end_call_info",
        note: "Offer to send info"
      }
    ]
  },

  close_timing_followup: {
    id: "close_timing_followup",
    type: "close",
    title: "Timing - Set Follow-up",
    script: `Okay, I'll reach back out in [timeframe]. In the meantime, should I send you some quick info so you have it when the timing's better?`,
    responses: [
      {
        label: "Yes, send info",
        nextNode: "end_call_info",
        note: "Get email, set follow-up"
      },
      {
        label: "No thanks",
        nextNode: "end_call_followup",
        note: "Set follow-up without info"
      }
    ]
  },

  obj_happy_current: {
    id: "obj_happy_current",
    type: "objection",
    title: "Objection: Happy with Current Process",
    script: `That's good to hear. Just curious - your team isn't spending time manually classifying and indexing documents anymore? Because if you figured that out, I'd love to know how.`,
    context: "You're gently challenging their 'we're fine' by asking about specifics.",
    responses: [
      {
        label: "\"Well, we still do some manual work...\"",
        nextNode: "pitch_happy_current_pivot",
        note: "Found the opening"
      },
      {
        label: "\"No, it's truly automated\"",
        nextNode: "end_satisfied_customer",
        note: "Rare - end gracefully"
      }
    ]
  },

  pitch_happy_current_pivot: {
    id: "pitch_happy_current_pivot",
    type: "pitch",
    title: "Pivot from 'Happy' Objection",
    script: `Right. So you're 'all set' in that you've got a process that works, but it's still manual work, right?

What if I could show you how to cut that manual time by 70-80%? Twenty minutes to see what full automation looks like. Even if you don't change anything, you'll know what's possible. What do you say?`,
    responses: [
      {
        label: "Okay, let's take a look",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "Still not interested",
        nextNode: "end_call_info",
        note: "Offer to send info"
      }
    ]
  },

  obj_send_info: {
    id: "obj_send_info",
    type: "objection",
    title: "Objection: Send Me Information",
    script: `I can send something, but honestly it's hard to appreciate on paper. This is really visual - seeing the AI read a document in real time is what makes it click.

How about this: 20-minute demo where you see it working with your actual documents, THEN I'll send you everything. That way the info actually makes sense.

Does Thursday or Friday work better?`,
    context: "Email rarely converts. Try to get meeting first, then send info.",
    responses: [
      {
        label: "Okay, let's do the demo first",
        nextNode: "success_meeting_set",
        note: "Success!"
      },
      {
        label: "No, just send me info",
        nextNode: "obj_send_info_persistent",
        note: "They insist"
      }
    ]
  },

  obj_send_info_persistent: {
    id: "obj_send_info_persistent",
    type: "objection",
    title: "Persistent: Info Only",
    script: `Okay, I get it. What's your email? And what should I focus on - how it handles classification, patient matching, the workflow piece, or integration with [their EHR/DMS]?`,
    context: "Shows you're customizing, not sending generic brochure. Also keeps conversation going.",
    responses: [
      {
        label: "They provide email and interest areas",
        nextNode: "close_send_info_tentative",
        note: "Try for tentative meeting"
      }
    ]
  },

  close_send_info_tentative: {
    id: "close_send_info_tentative",
    type: "close",
    title: "Tentative Meeting Request",
    script: `Got it. I'll send that over today. Can we at least tentatively get 20 minutes on your calendar for next week? If the info doesn't resonate, you can always cancel. Fair?`,
    responses: [
      {
        label: "Okay, tentatively",
        nextNode: "success_meeting_set",
        note: "Got tentative meeting"
      },
      {
        label: "No, I'll reach out if interested",
        nextNode: "end_call_info",
        note: "Send info, follow up later"
      }
    ]
  },

  obj_not_decision_maker: {
    id: "obj_not_decision_maker",
    type: "objection",
    title: "Objection: Not the Decision Maker",
    script: `I totally get it - these decisions usually involve a few people. But here's why I wanted to talk to you specifically: you're in the trenches every day, right? You know exactly what's working and what's not.

When your organization does evaluate solutions like this, your input is going to matter because you're the one who'll actually be using it.

How about this: see it for yourself first - 20 minutes. If it looks like something that could help your team, you'll know exactly what to say when those conversations come up. If not, no harm done. Fair?`,
    context: "HIM managers/directors often say this, but their input matters. Don't give up.",
    responses: [
      {
        label: "Okay, I'll take a look",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "Still want to include others",
        nextNode: "close_include_others",
        note: "Multi-stakeholder opportunity"
      },
      {
        label: "No, I can't commit",
        nextNode: "disc_get_referral",
        note: "Get other contacts"
      }
    ]
  },

  close_include_others: {
    id: "close_include_others",
    type: "close",
    title: "Include Other Stakeholders",
    script: `Perfect. Let me get a time that works for everyone. What's the best way to coordinate that - should I reach out to them, or would you prefer to set it up?`,
    responses: [
      {
        label: "I'll coordinate",
        nextNode: "success_meeting_set",
        note: "Get their email, have them send availability"
      },
      {
        label: "You should reach out to them",
        nextNode: "close_get_contacts",
        note: "Get contact info for stakeholders"
      }
    ]
  },

  disc_get_referral: {
    id: "disc_get_referral",
    type: "discovery",
    title: "Get Other Contacts",
    script: `No problem. Who else would typically be involved in a decision like this - your director, IT, Revenue Cycle?`,
    responses: [
      {
        label: "They provide names/contacts",
        nextNode: "close_get_contacts",
        note: "Got referral"
      },
      {
        label: "They won't share",
        nextNode: "end_call_info",
        note: "Send info, end politely"
      }
    ]
  },

  close_get_contacts: {
    id: "close_get_contacts",
    type: "close",
    title: "Capture Stakeholder Contacts",
    script: `Would it make sense to have them on the demo too, or would you want to see it first and then bring it to them?`,
    responses: [
      {
        label: "Let's include them from the start",
        nextNode: "success_meeting_set",
        note: "Multi-stakeholder meeting"
      },
      {
        label: "I'll look at it first",
        nextNode: "close_ask_main",
        note: "Schedule for them, loop others in later"
      }
    ]
  },

  obj_cost: {
    id: "obj_cost",
    type: "objection",
    title: "Objection: How Much Does It Cost?",
    script: `Fair question. It's based on your volume and what you need. For most HIM departments your size, when you look at the time savings versus the cost, it pays for itself pretty quickly.

Here's what makes more sense: let me get you on a call with our specialist. They can show you what it does AND give you real numbers based on your volume. Then you can decide if the math works. Sound fair?`,
    context: "Don't give pricing on cold call. You don't have enough info, and it becomes the focus instead of value.",
    responses: [
      {
        label: "Okay, let's see the numbers",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "Give me a ballpark",
        nextNode: "obj_cost_pushback",
        note: "They push for a number"
      },
      {
        label: "We don't have budget",
        nextNode: "obj_no_budget",
        note: "Budget objection"
      }
    ]
  },

  obj_cost_pushback: {
    id: "obj_cost_pushback",
    type: "objection",
    title: "Cost: Push for Number",
    script: `I don't want to throw out a number that's not accurate for your situation. It depends on how many documents you're processing, which modules you need, and your integration requirements.

But I can tell you it's subscription-based, so you're not making a massive capital investment. And most organizations find the ROI is there within the first few months because of the staff time saved.

Let's get you on a demo where we can talk real numbers based on your specifics. Does [day/time] work?`,
    keyPoints: [
      "Don't quote without info - You'll either be too high or too low",
      "Subscription model - Not huge upfront cost",
      "ROI focus - Value, not just cost",
      "Move to demo - Where pricing discussion belongs"
    ],
    responses: [
      {
        label: "Okay, let's schedule",
        nextNode: "success_meeting_set",
        note: "Success"
      },
      {
        label: "Still want a number first",
        nextNode: "end_call_info",
        note: "Send info with general pricing info"
      }
    ]
  },

  obj_no_budget: {
    id: "obj_no_budget",
    type: "objection",
    title: "Objection: No Budget",
    script: `I totally get it - budget is always tight. Here's the thing though: what you're spending on staff time to manually process documents - that's budget too, right?

When we save your team 5-10 hours a week, that's money you're getting back. A lot of organizations find that the time savings actually pays for the system.

Let's at least see what it would look like. Our specialist can show you the cost versus the time savings based on your volume. Then you can decide if it's worth pursuing budget for. If the ROI isn't there, we'll both know. Fair?`,
    responses: [
      {
        label: "Okay, let's look at the ROI",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "When's your next budget cycle?",
        nextNode: "close_budget_cycle",
        note: "Future planning"
      },
      {
        label: "We really can't right now",
        nextNode: "end_call_info",
        note: "End with info"
      }
    ]
  },

  close_budget_cycle: {
    id: "close_budget_cycle",
    type: "close",
    title: "Budget Cycle Planning",
    script: `Fair enough. When does your next budget cycle open up? Even if there's no money right now, it might make sense to see this so you can plan for it in next year's budget. That way when the time comes, you've already got the business case built.`,
    responses: [
      {
        label: "They give budget timeline",
        nextNode: "close_ask_main",
        note: "Schedule for planning purposes"
      },
      {
        label: "Not interested in planning ahead",
        nextNode: "end_call_followup",
        note: "Set long-term follow-up"
      }
    ]
  },

  obj_contract: {
    id: "obj_contract",
    type: "objection",
    title: "Objection: Just Renewed Contract",
    script: `Okay, so you're locked into [OnBase] for a while. That's actually fine - we're not asking you to rip and replace it.

What we do is add an AI layer on TOP of [OnBase]. Documents get processed automatically by our AI first, then feed into [OnBase] already classified and indexed. [OnBase] stays for storage and workflows, but now your team isn't doing all that manual front-end work.

So you get more value out of the [OnBase] investment you already made. The contract you just renewed doesn't prevent you from adding intelligence on top of it.

Worth seeing how that would work?`,
    context: "Position as complementary, not replacement.",
    responses: [
      {
        label: "That could work",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We need to focus on current system",
        nextNode: "obj_timing",
        note: "Timing objection"
      }
    ]
  },

  obj_implementing: {
    id: "obj_implementing",
    type: "objection",
    title: "Objection: Currently Implementing",
    script: `I totally get it - implementations are all-consuming.

Here's the thing though: when you go live on [new system], your team is going to be drowning in documents that need processing, right?

Having automation like Dexit in place BEFORE go-live means you're not dealing with that manual work during the most critical time.

Also, we can implement alongside your [system] project without disrupting it. Different teams, different timelines.

At minimum, worth seeing how it works so you know what's possible when things settle down after go-live. Twenty minutes now could save you a lot of pain later. What do you think?`,
    responses: [
      {
        label: "Good point, let's take a look",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We need to focus on current project",
        nextNode: "end_call_followup",
        note: "Set follow-up for after go-live"
      }
    ]
  },

  obj_waiting_gallery: {
    id: "obj_waiting_gallery",
    type: "objection",
    title: "Objection: Waiting for Epic Gallery",
    script: `I hear you. Epic has been talking about Gallery for a while. A few things to consider:

First, even when Gallery is fully available, it's designed primarily for clinical documents already in Epic. External documents - faxes from non-Epic providers, scanned paper, outside records - that's still going to require processing.

Second, Gallery doesn't have AI automation built in. Someone still has to classify and index documents manually.

And third, while you wait - whether it's 6 months or 2 years - your team is doing manual work every single day. That's time and money being lost.

Here's what we can do: Dexit works NOW and integrates with Epic. When Gallery does come out, we can work alongside it or help you transition. But why wait and keep doing manual work when you could be saving time today?

Plus, we can help with the Gallery migration when the time comes. Make sense?`,
    metadata: {
      competitorInfo: "Gallery: Timeline uncertain, limited scope (Epic docs only), no AI, can't handle non-clinical docs."
    },
    responses: [
      {
        label: "That's a good point",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We're committed to waiting",
        nextNode: "end_call_info",
        note: "Send info, follow up"
      }
    ]
  },

  obj_looking_competitor: {
    id: "obj_looking_competitor",
    type: "objection",
    title: "Objection: Looking at Competitor",
    script: `That's smart - you should look at options. [Competitor] is a good solution.

If you're already evaluating, it's probably worth adding us to the comparison, right? That way you're making sure you're picking the best option.

We're usually differentiated on three things:

One, our purpose-built healthcare AI - DextractLM is trained specifically on healthcare documents, not adapted from other industries.

Two, continuous learning - our AI gets smarter with every correction your team makes.

And three, we're typically more cost-effective and faster to implement than [enterprise competitors like Vyne/Brainware].

Worth adding us to your evaluation? It's just 20 minutes to see how we compare.`,
    responses: [
      {
        label: "Yes, add you to evaluation",
        nextNode: "close_ask_main",
        note: "Success - get in the evaluation"
      },
      {
        label: "We're too far along",
        nextNode: "end_call_info",
        note: "Send info anyway"
      }
    ]
  },

  obj_vendor_consolidation: {
    id: "obj_vendor_consolidation",
    type: "objection",
    title: "Objection: Vendor Consolidation",
    script: `I understand the push to consolidate vendors. But here's the reality: even with full consolidation to Epic, Gallery doesn't have AI automation. Your staff will still be manually processing documents.

Dexit isn't adding complexity - we're removing manual work. And we integrate seamlessly with Epic, so we're not a separate workflow for your team.

Think of it this way: you consolidate to Epic for storage and viewing, Dexit handles the intelligent processing. That's actually LESS work for your team than going Gallery-only with manual processing.

Worth 20 minutes to see how that workflow looks?`,
    responses: [
      {
        label: "Let me see it",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "Epic-only is our mandate",
        nextNode: "end_call_info",
        note: "Send info, check back later"
      }
    ]
  },

  obj_procurement: {
    id: "obj_procurement",
    type: "objection",
    title: "Objection: Procurement/Security Review",
    script: `Absolutely - that's expected in an organization your size. We've been through procurement and security reviews with dozens of healthcare organizations.

Here's what usually works: let's get you on a demo first so you know if it's even worth starting those processes. If it's a fit functionally, then we engage with procurement and security and provide whatever they need.

We're SOC 2 Type 2 certified, HIPAA compliant, and we've got all the security documentation ready to go. But no point starting that process if the solution doesn't fit your needs, right?

Twenty minutes to see if it's worth pursuing. What do you think?`,
    responses: [
      {
        label: "Makes sense, let's do the demo",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "We need approvals before demos",
        nextNode: "end_call_info",
        note: "Send security docs, follow up"
      }
    ]
  },

  obj_change_management: {
    id: "obj_change_management",
    type: "objection",
    title: "Objection: Change Management Concerns",
    script: `That's a legitimate concern - change is always hard. But here's what's different: we're not asking your staff to change their process. We're eliminating work they don't want to do.

Right now, they're opening every document, classifying it, matching to patients, indexing - that's repetitive, tedious work. Nobody WANTS to do that.

With Dexit, that work just...stops. Documents show up already processed. They only look at the exceptions. Less work, same or better outcomes.

In our experience, this is one of the easiest changes to adopt because we're taking away pain, not adding complexity.

Worth seeing how the user experience would change for your team?`,
    responses: [
      {
        label: "Okay, let's see it",
        nextNode: "close_ask_main",
        note: "Move to scheduling"
      },
      {
        label: "Our staff is resistant to any change",
        nextNode: "end_call_info",
        note: "Send info focused on user experience"
      }
    ]
  },

  obj_whats_this_about: {
    id: "obj_whats_this_about",
    type: "objection",
    title: "Objection: What's This About?",
    script: `Sure - 314e helps HIM teams automate document processing. So when faxes, medical records, referrals come in - instead of your team manually classifying and indexing each one, our AI does it automatically.

Most HIM teams we talk to are spending hours a day on this. We help them get that time back.

Quick question: how much of your team's time goes into document handling right now?`,
    context: "This is essentially a second chance at the opening. Deliver the value prop clearly and pivot back to discovery.",
    keyPoints: [
      "Keep it brief - they asked, so answer",
      "End with a question to regain control",
      "Sound helpful, not defensive"
    ],
    responses: [
      {
        label: "They engage - answer the question",
        nextNode: "disc_mostly_manual",
        note: "Good - back on track"
      },
      {
        label: "\"We're fine\" / \"Not interested\"",
        nextNode: "obj_not_interested",
        note: "Handle as not interested"
      },
      {
        label: "\"Send me some info\"",
        nextNode: "obj_send_info",
        note: "Handle as send info objection"
      }
    ]
  },

  // ===== SATISFIED CUSTOMER =====
  end_satisfied_customer: {
    id: "end_satisfied_customer",
    type: "end",
    title: "Satisfied Customer - Plant Seeds",
    script: `That's great - sounds like you've got things working well. Not everyone can say that.

If anything ever changes - budget constraints, system issues, new requirements - feel free to reach out. I'll send you my contact info just in case.

Have a great day!`,
    context: "Don't push. Plant seeds for the future.",
    responses: [
      {
        label: "End call",
        nextNode: "end_call_no",
        note: "End gracefully"
      }
    ]
  },

  // ===== CALL ENDINGS =====
  success_call_end: {
    id: "success_call_end",
    type: "success",
    title: "Call End - Meeting Set!",
    script: `Perfect, [Name]. You'll get a calendar invite from me today for [day/time]. You'll meet with [SME name] and they'll show you exactly how this works with your [Epic/Cerner] and [OnBase/current setup].

If you think of any questions before then, feel free to email me at {email}. Looking forward to it!`,
    context: "MEETING SET - Mark as success in CRM",
    keyPoints: [
      "Send calendar invite within 1 hour",
      "Send confirmation email with prep info",
      "Update CRM with detailed notes",
      "Set reminder to confirm 1 day before demo"
    ],
    responses: []
  },

  end_call_info: {
    id: "end_call_info",
    type: "end",
    title: "Call End - Sending Info",
    script: `No worries, [Name]. I'll send you that information today. I'll check back with you in a couple days to see if you have questions and if a quick demo makes sense.

Feel free to reach out if anything comes up before then. Have a great day!`,
    context: "Send customized information within 2 hours. Set follow-up reminder (2-3 days). Update CRM with next steps.",
    responses: []
  },

  end_call_followup: {
    id: "end_call_followup",
    type: "end",
    title: "Call End - Follow-up Scheduled",
    script: `Sounds good, [Name]. I'll reach back out in [timeframe] when the timing is better.

In the meantime, if anything changes or you have questions, don't hesitate to reach out. Have a great day!`,
    context: "Set follow-up reminder for specified timeframe. Update CRM.",
    responses: []
  },

  end_call_no: {
    id: "end_call_no",
    type: "end",
    title: "Call End - Not Interested",
    script: `No problem, [Name]. I appreciate your time. If anything changes down the road, feel free to reach out.

Have a good one!`,
    context: "Update CRM as 'Not Interested - [Reason]'. Set long-term follow-up (6-12 months) if appropriate. Move on professionally.",
    responses: []
  },

  // ===== VOICEMAIL =====
  end_voicemail: {
    id: "end_voicemail",
    type: "end",
    title: "Voicemail Script",
    script: `Hi [Name], this is [First] from 314e. We have an AI-powered document processing system that automates classification, patient matching, and indexing for HIM teams - so your staff isn't doing it all manually.

Most HIM departments are seeing 70-80% time savings.

If you want to see how the system works, feel free to reach out! My number is 608-597-4334.

Again, [First] from 314e at 608-597-4334. Thanks!`,
    context: "Keep it under 30 seconds. Send follow-up email within 1 hour.",
    keyPoints: [
      "Who you are - Name and company",
      "What you do - Automate document processing",
      "Key benefit - 70-80% time savings",
      "Next step - Email + calendar link",
      "Contact info - Phone number (twice)"
    ],
    responses: []
  }
};

export const quickReference = {
  differentiators: [
    "DextractLM™ - Purpose-built healthcare LLM (not adapted from other industries)",
    "Continuous Learning - AI improves automatically from corrections",
    "70-80% Time Savings - Only 10-20% of documents need human review",
    "Virtual Fax Server - Built-in, AI-powered fax routing (inbound/outbound)",
    "EHR Agnostic - Works with Epic, Cerner, Meditech, any EHR",
    "Complements Existing Systems - Works WITH OnBase/Gallery, not replacing",
    "Subscription Pricing - Not massive capital investment",
    "20+ Years - 314e healthcare IT experience"
  ],
  competitors: {
    onbase: {
      name: "OnBase",
      strengths: ["Storage", "Workflow", "Enterprise-proven"],
      limitations: ["No AI", "Manual indexing required", "Keyword rules brittle"],
      advantage: "AI intelligence for front-end processing, works WITH OnBase"
    },
    brainware: {
      name: "Brainware",
      strengths: ["Better than basic OCR"],
      limitations: ["Expensive add-on ($50K-$200K+)", "Built before modern AI", "Requires training and retraining"],
      advantage: "Modern LLM, pre-trained, continuous learning, more cost-effective"
    },
    gallery: {
      name: "Epic Gallery",
      strengths: ["Epic integration", "Good for Epic clinical docs"],
      limitations: ["No AI", "Not for external/non-clinical docs", "Still maturing"],
      advantage: "AI processing + handles non-clinical + migration help"
    },
    vyne: {
      name: "Vyne",
      strengths: ["Strong for referrals", "Established presence"],
      limitations: ["Referral-focused", "AI bolted on", "Enterprise pricing"],
      advantage: "All document types, modern AI, flexible pricing"
    },
    solarity: {
      name: "Solarity",
      strengths: ["Healthcare-focused", "Has AI/ML"],
      limitations: ["Smaller company", "AI sophistication unclear"],
      advantage: "DextractLM proven, 314e backing, continuous learning"
    }
  }
};
