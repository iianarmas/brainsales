INSTRUCTIONS FOR CLAUDE (Web App Builder)
Purpose of This Document
This is a complete cold calling script flowchart for setting appointments with HIM (Health Information Management) Managers/Directors to demo Dexit, an AI-powered intelligent document processing system.

Web App Requirements
Overview
Build an interactive flowchart web application that guides a sales caller through a conversation in real-time based on the prospect's responses.
Core Functionality

Node-Based Navigation

Each section is a "node" in the conversation
User clicks buttons representing the prospect's response
App navigates to the appropriate next node
Display the script the caller should say

User Interface Requirements
Layout:

Left Panel (30% width):

Navigation breadcrumb showing conversation path
"Go Back" button to return to previous node
"Reset" button to start over
Current conversation context display

Main Panel (70% width):

Large, readable text showing what the caller should say
Multiple choice buttons for prospect responses
Visual indicators for different types of nodes:

🎯 Opening (green)
🔍 Discovery (blue)
💡 Pitch (purple)
🎯 Ask for Meeting (orange)
🚫 Objection (red)
✅ Success (green)
❌ End Call (gray)

Response Button Types
Each node should have clearly labeled buttons for prospect responses:

Direct quotes: "Mostly Manual"
Paraphrased options: "They mention issues/complaints"
System names: "OnBase", "Epic Gallery", "Solarity", etc.
Common objections: "Not Interested", "Send Info", "No Budget"
Yes/No options: "Yes", "No", "Maybe"

Special Features

Search Function: Search for keywords (e.g., "Brainware", "Epic Gallery")
Notes Field: Allow caller to type notes about the conversation
Quick Reference Sidebar: Toggleable sidebar with key talking points
Timer: Track call duration
Export: Button to export conversation path and notes

Visual Design

Clean, professional interface
High contrast for readability
Mobile-responsive (caller might use on tablet)
Keyboard shortcuts for power users
Print-friendly version

Data Structure
Each node should contain:

javascript {
id: "unique_node_id",
type: "opening|discovery|pitch|objection|close",
title: "Node Title",
script: "What the caller should say",
context: "Background info for this node",
responses: [
{
label: "Response option text",
nextNode: "target_node_id",
note: "Optional guidance for caller"
}
],
metadata: {
competitorInfo: "Relevant competitor details",
keyPoints: ["Bullet points of key info"],
warnings: ["Things to avoid saying"]
}
}

Conversation Path Tracking

Display visual breadcrumb trail
Show which competitors/systems were mentioned
Highlight if moving toward objection or success
Suggest optimal paths based on conversation history

Content Organization
The script is organized into these main sections:

Opening - Initial contact and first question
Response Paths - Based on how they answer the opening
EHR Discovery - Understanding their Electronic Health Record system
DMS Discovery - Understanding their Document Management System
Specific Paths - OnBase, Epic Gallery, Other DMS, EHR-only scenarios
Pitch - Full Dexit value proposition
The Ask - Requesting the meeting
Objection Handling - Responses to common objections
Competitor Objections - Specific responses for each competitor
Closing - How to end the call successfully

Key Product Information
About Dexit

AI-powered intelligent document processing system
Made by 314e Corporation (20+ years in healthcare IT)
Main AI technology: DextractLM™ - proprietary Large Language Model trained specifically on healthcare documents
Key capabilities:

Automatic document classification
Patient matching via MPI (Master Patient Index)
Data extraction from unstructured documents
Continuous learning from user corrections
Virtual fax server (inbound/outbound)
Workflow automation with drag-and-drop builder
Integration with any EHR (Epic, Cerner, Meditech, etc.)

Key Metrics

70-80% reduction in manual processing time
95%+ accuracy rate out of the box
Users only review 10-20% of documents (exceptions)
Subscription-based pricing (usage-based)

Competitor Information (For Objection Handling)
OnBase (by Hyland)
What It Is:

Enterprise Content Management (ECM) and Document Management System
Been around for 30+ years
Market leader in healthcare DMS

Strengths:

Excellent workflow automation (routing, approvals, notifications)
Robust storage and retrieval
Mature, proven technology
Strong Epic integration via Unity Client
Handles enterprise-wide documents (clinical and non-clinical)

Limitations:

No AI-native classification - uses keyword rules or basic pattern matching
Manual indexing required - staff still processes each document manually
Zone OCR limitations - requires template setup for each form type
Expensive licensing - perpetual license + annual maintenance
Complex administration - requires dedicated OnBase administrators
Slow innovation - older platform, not cloud-native

OnBase with Brainware (Intelligent Capture Add-on):
What It Is:

Hyland's AI/ML document capture solution
Separate expensive license on top of OnBase

Strengths:

Better than basic OCR and keyword rules
Can learn from sample documents
Provides confidence scoring

Limitations:

Built before modern AI - not using current-generation LLMs
Expensive - significant additional cost (often $50K-$200K+ depending on scale)
Requires training - need to feed samples for each document type
Periodic retraining needed - doesn't continuously learn
Complex to configure - requires Brainware expertise or consultants
Professional services required - implementation costs add up
Not healthcare-specific - general AI adapted for healthcare

Key Dexit Advantages:

Modern AI - DextractLM is current-generation LLM vs. Brainware's older AI
Pre-trained - Works immediately vs. Brainware's training requirement
Continuous learning - Learns from every correction vs. periodic retraining
Healthcare-specific - Built for healthcare vs. adapted for healthcare
Cost-effective - Subscription pricing typically lower than OnBase + Brainware
Easy to configure - No Brainware expertise needed
Complements OnBase - Can work alongside OnBase for storage/workflow

Positioning:
"OnBase is great for storage and workflow. Brainware adds some AI, but it's expensive and complex. Dexit gives you better AI accuracy, easier configuration, continuous learning, and lower cost - while still working with your OnBase investment."

Epic Gallery
What It Is:

Epic's newer document management and viewing capability
Released incrementally starting ~2020
Part of Epic ecosystem

Strengths:

Native Epic integration (no third-party needed)
Good for viewing clinical documents created in Epic
Included in Epic licensing (perceived as "free")
Modern interface within Epic

Limitations:

Still maturing - relatively new, missing features
No AI automation - manual classification and indexing required
Clinical document focus - primarily for documents already in Epic
Limited for external documents - not designed for high-volume external intake
Not for non-clinical docs - doesn't handle HR, Finance, Legal documents
Limited workflow - less sophisticated than dedicated DMS
Epic-only - doesn't help with non-Epic systems

Epic's Position:

Epic pushes Gallery to reduce third-party dependencies
Pressure on customers to "consolidate to Epic ecosystem"
Reality: Gallery doesn't replace full DMS capabilities

Key Dexit Advantages:

AI automation - Gallery has no AI; manual work remains
External document processing - Handles faxes, scans from non-Epic sources
Non-clinical document support - HR, Finance, Legal docs that Gallery can't manage
Data migration assistance - Help moving from OnBase/other DMS to Gallery
Works WITH Gallery - Can be intelligent front-end for Gallery
Available now - Gallery still rolling out features; Dexit ready today

Positioning:
"Gallery is good for Epic clinical documents, but it doesn't have AI and doesn't handle external or non-clinical documents well. We can help with your Gallery migration AND add the automation Gallery lacks. Plus, we handle the documents Gallery isn't designed for."

Solarity (formerly Notable Solutions)
What It Is:

Independent healthcare intelligent document processing vendor
Rebranded from Notable Solutions
Focused on healthcare-specific capture and workflow

Strengths:

Healthcare-focused (not adapted from other industries)
Has AI/ML capabilities for classification and extraction
Workflow automation included
Works with multiple EHRs
Cloud-based modern platform

Limitations:

Smaller company - independent vendor, resource constraints vs. larger competitors
Less market presence - not as well-known as OnBase/Epic
AI sophistication unclear - unclear if they have proprietary healthcare LLM like DextractLM
Learning capabilities - unclear if continuous learning vs. periodic retraining

What We Don't Know (Need to Probe):

Whether their AI is rule-based or truly intelligent
If it learns continuously or requires retraining
Accuracy rates and confidence scoring
Pricing model and cost comparison
Implementation complexity

Key Dexit Advantages:

DextractLM - Proprietary healthcare LLM (proven, documented)
314e backing - 20+ years healthcare IT vs. smaller independent vendor
Proven at scale - Established customer base (John Muir, Fairview, UC Irvine)
Continuous learning - Explicit human-in-the-loop design
Comprehensive platform - Fax server, workflows, analytics all included

Positioning:
"Solarity is a good solution - they're healthcare-focused like us. The key differences are our purpose-built LLM (DextractLM), our continuous learning capability, and 314e's 20+ years of healthcare IT experience and resources backing the product. Worth comparing both side-by-side."
Discovery Questions to Ask:

"How does Solarity's AI work - is it rule-based or does it use machine learning?"
"Does it learn from corrections, or do you need to retrain it periodically?"
"What's your accuracy rate with Solarity?"
"How complex was the implementation?"

Vyne Medical
What It Is:

Healthcare document workflow and referral management platform
Products: Trace (referrals), Capture (documents/fax), Exchange (provider-to-provider)
Established player, been around for years

Strengths:

Very strong for referrals - market leader in referral management
Good provider-to-provider document exchange
Network effect (connects multiple organizations)
Established presence and track record
Includes fax capabilities

Limitations:

Referral-focused - strongest for referrals, less robust for other document types
AI added later - platform built before modern AI, features bolted on
Not AI-native - AI is "a feature" not the foundation
Enterprise pricing - expensive, long contracts (3-5 year typical)
Complex implementation - requires professional services
Less flexible - more prescribed workflows vs. customizable

Key Dexit Advantages:

All document types - Equal strength across all workflows (not just referrals)
AI-native - Built with AI from day one vs. added later
Broader coverage - Prior auths, ROI, general clinical docs, not just referrals
Modern architecture - Cloud-native vs. older platform modernized
Flexible workflows - Drag-and-drop builder vs. prescribed processes
Flexible pricing - Subscription vs. long enterprise contracts
Faster innovation - Agile development vs. established slower pace

Positioning:
"Vyne is strong for referrals specifically. If referral management is your only need, they're solid. But Dexit handles ALL document types with the same AI intelligence - prior auths, ROI, clinical documents, referrals. Plus we're AI-native with modern architecture, flexible workflows, and typically more cost-effective."
Discovery Questions to Ask:

"Is your focus primarily on referrals, or do you need other workflows too?"
"Are you locked into a long-term Vyne contract?"

Generic "We Have [Unknown System]"
Discovery Questions:

"Does that system automatically classify documents, or is there still manual work?"
"Does it use AI, or is it more rule-based?"
"Does it learn from corrections, or do you configure rules for each document type?"
"What's working well, and where are the gaps?"
"How much maintenance does it require?"

Universal Positioning:
"[System] may have capabilities, but here's what makes Dexit different: We have DextractLM - a purpose-built healthcare AI that's pre-trained on thousands of healthcare documents. It learns continuously from corrections, requires minimal configuration, and typically delivers 95%+ accuracy out of the box. Worth seeing how modern AI compares to what you're using now?"

Important Guidelines for the Web App
For the Caller (User Instructions)

Start at Opening - Always begin with the standard opening
Listen Actively - Click the button that BEST matches what the prospect said (not what you wish they said)
Don't Skip Discovery - Always go through discovery to understand their environment
Stay on Script - Read what's displayed, don't improvise too much
Take Notes - Use the notes field to capture important details
Be Flexible - If conversation goes off-script, use search or "Go Back" to find relevant section

Visual Indicators

🟢 Green Nodes = Positive progress (engagement, interest, meeting set)
🔵 Blue Nodes = Discovery (gathering information)
🟣 Purple Nodes = Pitching/Presenting value
🟠 Orange Nodes = Critical moments (the ask, handling objections)
🔴 Red Nodes = Objections or resistance
⚫ Gray Nodes = Call ending (successful or unsuccessful)

Tooltips/Helper Text
Each node should have optional tooltip/helper text that appears on hover:

Why we ask this - Context for the question
What to listen for - Key information to capture
Red flags - Warning signs in their response
Green flags - Positive buying signals

Technical Implementation Suggestions
Recommended Tech Stack

Frontend: React or Vue.js for interactivity
State Management: Redux or Vuex to track conversation path
Styling: Tailwind CSS for rapid UI development
Icons: Lucide React or Font Awesome
Data: JSON file containing all nodes and responses
Export: jsPDF or similar for generating call summaries

Data Flow Example
javascript// Example node structure
{
id: "opening",
type: "opening",
title: "Opening Script",
script: "Hi [Name], [First] from 314e - we work with HIM teams on document automation. Quick question: when documents come in, how much is your team handling manually?",
context: "This is a pattern interrupt opening. Goal is to get them talking about their process, not pitch immediately.",
keyPoints: [
"Sound curious, not sales-y",
"Pause after the question - let them answer",
"Don't rush through this"
],
responses: [
{
label: "Mostly Manual / A Lot",
nextNode: "response_path_1",
note: "This is the ideal response - they have clear pain"
},
{
label: "Some Is Automated",
nextNode: "response_path_2",
note: "They have partial automation - dig deeper"
},
{
label: "It's All Automated / We're Fine",
nextNode: "response_path_3",
note: "Challenge this gently - most aren't truly automated"
}
]
}
Conversation State Example
javascript{
currentNode: "onbase_basic",
conversationPath: ["opening", "response_path_1", "ehr_epic", "onbase_path", "onbase_basic"],
metadata: {
prospectName: "Sarah Johnson",
organization: "Memorial Hospital",
ehr: "Epic",
dms: "OnBase",
automation: "Keyword rules only",
painPoints: ["Manual indexing", "High volume", "Accuracy issues"],
competitors: ["OnBase"],
objections: []
},
notes: "They process 500 docs/day with 6 FTEs. Interested but concerned about cost.",
callDuration: "4:23",
outcome: null // "meeting_set", "follow_up", "not_interested", etc.
}

```

---

## **Now, Here's the Complete Call Flow Script:**

---

# HIM Manager/Director Cold Call Flow - Complete Script

## Table of Contents
1. [Opening](#opening)
2. [Response Paths](#response-paths)
3. [EHR Discovery Path](#ehr-discovery-path)
4. [DMS Discovery Path](#dms-discovery-path)
5. [Pitch: Dexit Solution](#pitch-dexit-solution)
6. [The Ask](#the-ask)
7. [Objection Handling](#objection-handling)
8. [Closing Statements](#closing-statements)
9. [Quick Reference](#quick-reference)
10. [Voicemail Script](#voicemail-script)
11. [Follow-up Email Template](#follow-up-email-template)

---

## Opening

### Your Opening Script
```

Hi [Name], [First] from 314e - we work with HIM teams on document automation.
Quick question: when documents come in, how much is your team handling manually?

```

**Action:** WAIT - Let them answer

**Context:** This is a pattern interrupt. Most prospects expect a pitch; instead, you're asking about THEIR process. Stay curious, not sales-y.

**Listen For:**
- Volume indicators (how many documents)
- Pain indicators (frustration, time spent)
- Current systems mentioned
- Team size clues

---

## Response Paths

### Response Path 1: "Mostly Manual" / "A Lot"

**Type:** 🟢 Positive - They have clear pain

**You Say:**
```

Yeah, I hear that constantly. What's eating up most of the time -
classification, patient matching, or the indexing piece?

```

**Action:** WAIT - Let them elaborate

**Why This Matters:** You're narrowing down their specific pain point. This helps customize your pitch later.

**Then:**
```

Right, and with [X] documents a day, that adds up.
What system are you using - Epic, Cerner, something else?

```

**Action:** WAIT for EHR answer

**Next:** Go to [EHR Discovery Path](#ehr-discovery-path)

---

### Response Path 2: "Some Is Automated"

**Type:** 🔵 Discovery - Need to understand what's automated vs. manual

**You Say:**
```

Okay, good. What parts ARE automated, and what's still manual for your team?

```

**Action:** WAIT - Let them explain

**Listen For:**
- What's actually automated (often just routing)
- What's still manual (usually classification/indexing)
- Satisfaction level with current automation

**Then:**
```

Got it. So you've got some automation, but there's still manual work happening.
What system are you using for that - OnBase, something else?

```

**Action:** WAIT for answer

**Next:** Go to [DMS Discovery Path](#dms-discovery-path)

---

### Response Path 3: "It's All Automated" / "We're Fine"

**Type:** 🟠 Challenge - This is usually not true; probe gently

**You Say:**
```

That's impressive - you're ahead of most HIM departments.
Just curious, what are you using that's handling everything automatically?

```

**Action:** WAIT - They'll mention their system OR admit it's not truly automated

**Why This Works:** You're complimenting them while gently challenging. Most will clarify "well, not EVERYTHING..."

**If they name a system:**
```

Interesting. So [OnBase/Solarity/whatever] is automatically classifying documents,
matching to patients, and indexing without anyone touching them?

```

**Expected:** They'll usually admit: "Well, not exactly..." or "Someone still needs to verify..."

**You Say:**
```

Right - that's what I thought. Most systems need someone to at least verify or
correct things. That's actually the gap we fill. Want me to explain?

```

**Responses:**
- **If yes:** Go to [Pitch: Dexit Solution](#pitch-dexit-solution)
- **If no:** Go to [Objection: Not Interested](#objection-not-interested)

---

## EHR Discovery Path

**Context:** Understanding their EHR is critical because it affects integration, competitors they might be considering (Epic Gallery), and your positioning.

### They Say: "Epic"

**Type:** 🔵 Discovery

**You Say:**
```

Epic, okay. And for document management - are you using OnBase,
Epic Gallery, or just Epic's basic document storage?

```

**Why This Matters:** Epic customers often use OnBase, may be considering Gallery, or struggling with Epic alone.

**Branch Based on Answer:**

#### Branch A: "OnBase"
- **Next:** Go to [OnBase Path](#onbase-path)
- **Note:** Most common scenario for large Epic customers

#### Branch B: "Epic Gallery" or "Moving to Gallery"
- **Next:** Go to [Epic Gallery Path](#epic-gallery-path)
- **Note:** Epic is pushing Gallery; opportunity to position against it

#### Branch C: "Just Epic" (no DMS)
- **Next:** Go to [Epic-Only Path](#epic-only-path)
- **Note:** Often smaller organizations or those struggling with gaps

---

### They Say: "Cerner" or "Meditech" or Other EHR

**Type:** 🔵 Discovery

**You Say:**
```

[Cerner/Meditech], got it. And for document management -
are you using OnBase, or something else?

```

**Why This Matters:** Non-Epic EHRs less likely to have Gallery pressure, but still often use OnBase.

**Branch Based on Answer:**

#### Branch A: "OnBase"
- **Next:** Go to [OnBase Path](#onbase-path)
- **Note:** OnBase is EHR-agnostic, used across all EHRs

#### Branch B: "Other DMS" (Solarity, Vyne, etc.)
- **Next:** Go to [Other DMS Path](#other-dms-path)
- **Note:** Need to probe capabilities and satisfaction

#### Branch C: "Nothing separate, just the EHR"
- **Next:** Go to [EHR-Only Path](#ehr-only-path)
- **Note:** Good opportunity - no incumbent DMS to displace

---

## DMS Discovery Path

**Context:** This is where you understand their current document management and identify competitive displacement or complementary opportunities.

### OnBase Path

**Type:** 🔵 Discovery → 🟣 Pitch Opportunity

**You Say:**
```

OnBase, okay - so OnBase is handling storage and workflow.
Are you using any of OnBase's automation features,
like keyword classification or Brainware?

```

**Action:** WAIT for answer

**Why This Matters:**
- Keyword rules = basic automation, lots of manual work remains
- Brainware = expensive add-on, often underperforms expectations
- Neither = ALL manual work

---

#### Scenario A: "Just basic OnBase" / "Keyword rules"

**Type:** 🟢 Strong Opportunity - Clear gap

**You Say:**
```

Got it. So even with OnBase in place, your team is still opening each document,
figuring out what it is, matching to patients, typing in the metadata?

```

**Expected:** They say "Yes"

**You Say:**
```

Right, that's what we're seeing everywhere. OnBase is great for storage and workflows,
but it doesn't eliminate that front-end manual work. That's exactly what we solve.

Our AI - it's called DextractLM - handles all that automatically.
Reads the document, classifies it, pulls patient info, matches to your MPI,
indexes everything. Then it feeds into OnBase already processed.

So OnBase stays for what it's good at, but now your team isn't spending
hours on manual indexing. Most HIM teams get back 70-80% of the time
they were spending on this.

```

**Action:** Brief pause

**Competitor Context - OnBase Basic:**
- **Strength:** Workflow routing, storage, enterprise-proven
- **Weakness:** No AI, manual indexing required, keyword rules are brittle
- **Our Advantage:** AI automation for front-end processing, works WITH OnBase
- **Pricing:** OnBase licensing expensive; Dexit subscription often lower total cost

**Next:** Go to [The Ask](#the-ask)

---

#### Scenario B: "We have Brainware"

**Type:** 🟠 Competitive Displacement - Handle carefully

**You Say:**
```

Brainware - so you've got Hyland's intelligent capture add-on.
How's that working for you? Happy with the accuracy?

```

**Action:** WAIT - Listen carefully for dissatisfaction

**Why This Approach:** Don't immediately attack Brainware. Let them tell you the problems.

**Most Common Responses:**

##### Response A: "It's okay but..." / "We have issues with..."

**Type:** 🟢 Opportunity - They're dissatisfied

**You Say:**
```

Yeah, we hear that from a lot of Brainware users. It's better than basic keyword rules,
but it's complex to maintain and the accuracy isn't always there, right?

Here's the difference with Dexit: Brainware was built before the current generation of AI.
Our DextractLM is a modern large language model trained specifically on healthcare documents.
We're seeing 95%+ accuracy out of the box, and it learns continuously from corrections.

Plus, Brainware is expensive on top of OnBase. Dexit is subscription-based and
typically costs less overall. Worth comparing to see the difference?

```

**Competitor Context - Brainware:**
- **What It Is:** Hyland's AI/ML capture add-on, separate expensive license
- **Cost:** Often $50K-$200K+ depending on scale, on top of OnBase
- **Limitations:**
  - Built before modern AI (pre-2020 technology)
  - Requires training on sample documents
  - Periodic retraining needed (not continuous learning)
  - Complex configuration
  - Professional services required
  - Generic AI adapted for healthcare (not purpose-built)
- **Our Advantages:**
  - Modern LLM (DextractLM) vs. older AI
  - Pre-trained (works immediately) vs. requires training
  - Continuous learning vs. periodic retraining
  - Healthcare-specific vs. adapted for healthcare
  - Lower cost (subscription) vs. expensive license
  - Easy configuration vs. complex

**Next:** Go to [The Ask](#the-ask)

---

##### Response B: "It's working well"

**Type:** 🟠 Satisfied - Harder displacement

**You Say:**
```

That's good to hear - you're in the minority. Most Brainware users we talk to
have frustrations with it. Just curious - what's your accuracy rate,
and how much maintenance does it require?

```

**Action:** WAIT - They'll usually mention some issues (cost, maintenance, retraining)

**You Say:**
```

Right. Even if it's working well, here's what might be worth looking at:
Brainware requires periodic retraining when you add new document types or formats change.
Dexit learns continuously - every correction your team makes trains the AI automatically.

Also, we're typically more cost-effective than the Brainware license.
Worth a quick comparison?

```

**Note:** Don't hard-sell against satisfied Brainware users. Plant seeds for future consideration.

**Next:** Go to [The Ask](#the-ask)

---

### Epic Gallery Path

**Type:** 🔵 Discovery → 🟣 Strategic Opportunity

**Context:** Epic is actively pushing Gallery to reduce third-party DMS usage. Many organizations considering or piloting Gallery.

**You Say:**
```

Gallery - okay. Are you already using it, or planning to move to it?

```

---

#### Branch A: "Planning to move to Gallery"

**Type:** 🟢 Perfect Opportunity - Intervene before they commit

**You Say:**
```

Got it. So you're looking to move from [OnBase/current system] to Epic Gallery.
Can I ask what's driving that - vendor consolidation, cost, or something else?

```

**Action:** WAIT - Listen to their reasoning

**Common Reasons They'll Give:**
- "Epic is pushing us toward it"
- "Vendor consolidation"
- "Reduce number of systems"
- "It's included in Epic licensing"
- "Simplify our environment"

**Then:**
```

That makes sense. Here's something to consider: Gallery is good for clinical documents
that are already in Epic, but it's not designed for all the external stuff -
faxes from outside providers, non-clinical documents, high-volume intake.

Plus, Gallery doesn't have AI-powered automation. Someone still has to manually
classify and index documents.

Here's where we can help:

First, we can assist with your data migration from [current system] to Gallery -
we've done this before and can make the transition smoother.

Second, Dexit adds the AI automation that Gallery doesn't have. Documents get
processed automatically - classification, patient matching, extraction -
and then feed into Gallery already indexed.

And third, for non-clinical documents that Gallery can't handle - HR files,
contracts, admin documents - Dexit can manage those too.

So you get the Epic consolidation you want, plus automation you won't get
from Gallery alone. Make sense?

```

**Action:** Brief pause

**Competitor Context - Epic Gallery:**
- **What It Is:** Epic's document management/viewing capability (released ~2020+)
- **Strengths:**
  - Native Epic integration
  - Good for Epic-created clinical documents
  - Modern interface
  - Included in Epic licensing (perceived as "free")
- **Limitations:**
  - Still maturing (missing features)
  - NO AI automation (manual classification/indexing)
  - Designed for Epic clinical documents, not external intake
  - Doesn't handle non-clinical documents (HR, Finance, Legal)
  - Limited workflow capabilities vs. OnBase
  - Epic-only (doesn't help with non-Epic systems)
- **Our Advantages:**
  - AI automation (Gallery has none)
  - External document processing
  - Non-clinical document support
  - Data migration assistance
  - Works WITH Gallery as intelligent front-end
  - Available now (Gallery still rolling out)

**Next:** Go to [The Ask](#the-ask)

---

#### Branch B: "Already using Gallery"

**Type:** 🟠 Complementary Opportunity - Position as add-on

**You Say:**
```

Okay, so you're on Gallery. How's that working for you?
Is it handling everything you need?
Action: WAIT - They'll usually mention limitations
Common Complaints:

"Still pretty new, missing some features"
"Works okay for Epic docs, but external stuff is still manual"
"No automation, we're still indexing everything manually"
"Can't use it for non-clinical documents"

You Say:
Right, Gallery is pretty new and it has some gaps.
The big one is that it doesn't have AI automation -
someone still has to manually process documents before they go into Gallery.

That's where Dexit fits. Our AI handles the front-end processing automatically -
classification, patient matching, data extraction - and feeds into Gallery
already indexed. Gallery becomes the storage and viewing layer,
Dexit becomes the intelligence layer.

Plus, Dexit includes a virtual fax server, so you can eliminate physical fax machines
and have faxes process automatically too.

Most organizations find Gallery works better WITH intelligent automation in front of it.
Worth seeing how thatwould work?
Note: You're NOT competing with Gallery - you're complementing it. Gallery = storage, Dexit = intelligence.
Next: Go to The Ask

Other DMS Path
(Solarity, Vyne, or Unknown DMS)
Type: 🔵 Discovery - Need to understand capabilities
Context: These are less common but important competitors. You need to probe what they actually do.
You Say:
[Solarity/Vyne/System Name] - okay. Can I ask, does that system
automatically classify and index documents, or is there still manual work involved?
Action: WAIT - This is KEY discovery
Why This Matters: Many systems CLAIM automation but it's actually rule-based or requires heavy configuration.

If They Say: "Still manual" / "Some is automated"
Type: 🟢 Clear Opportunity
You Say:
Right, so even with [system name] in place, there's still manual processing happening.
That's the piece we automate with AI.

Our system - Dexit - uses a purpose-built healthcare AI called DextractLM.
It automatically classifies documents, extracts patient information,
matches to your MPI, and indexes everything. Your team only reviews
maybe 10-20% that need extra attention.

We can work alongside [system name], or potentially replace it depending on what you need.
Most HIM teams get back 70-80% of the time they were spending on manual indexing.

Worth seeing how this would work with your setup?
Next: Go to The Ask

If They Say: "It's mostly automated"
Type: 🟠 Challenge - Need to probe deeper
You Say:
Okay, that's good. What's it doing automatically - classification,
patient matching, data extraction?
Action: WAIT - Probe for specifics
Listen For:

What's actually automated vs. what requires human intervention
Whether it's rule-based or AI-based
Accuracy and error rates
Maintenance requirements

Then:
Got it. Can I ask - does it use AI, or is it more rule-based?
Like, does it learn from corrections, or do you have to configure rules for each document type?
Action: WAIT
Expected: Most systems are rule-based, so they'll say:
"It's rule-based" / "We have to configure it" / "It doesn't learn"
You Say:
Right, that's the difference with Dexit. We're not rule-based - we use a modern
large language model specifically trained on healthcare documents.
No rules to configure, no templates to maintain.

And it learns continuously - every correction your team makes trains the AI,
so accuracy improves over time for YOUR specific documents.

Plus, we include a virtual fax server with AI-powered fax routing,
so inbound and outbound faxes are automated too.

Worth comparing what modern AI can do versus rule-based systems?
Competitor Context - Solarity:

What It Is: Independent healthcare IDP vendor (formerly Notable Solutions)
Strengths:

Healthcare-focused (not adapted)
Has AI/ML capabilities
Cloud-based modern platform
Workflow automation included

Unknowns/Potential Weaknesses:

Smaller company vs. 314e's resources
Less market presence
AI sophistication unclear (proprietary LLM?)
Learning mechanism unclear (continuous vs. periodic retraining?)

Our Advantages:

DextractLM (proven, documented healthcare LLM)
314e backing (20+ years, Epic/Cerner partnerships)
Explicit continuous learning design
Proven customer base (John Muir, Fairview, UC Irvine)

Competitor Context - Vyne Medical:

What It Is: Referral management + document workflow platform
Products: Trace (referrals), Capture (docs/fax), Exchange (provider network)
Strengths:

Market leader for referral management
Strong provider-to-provider exchange
Established presence

Limitations:

Referral-focused (less robust for other workflows)
AI added to older platform (not AI-native)
Enterprise pricing, long contracts (3-5 years)
Complex implementation
Prescribed workflows (less flexible)

Our Advantages:

Equal strength across ALL document types (not just referrals)
AI-native from day one
Modern cloud architecture
Flexible workflows (drag-and-drop)
Subscription pricing, shorter commitments
Faster innovation

Next: Go to The Ask

Epic-Only Path
(No separate DMS, using Epic alone)
Type: 🟢 Strong Opportunity - Clear gap, no incumbent to displace
Context: Smaller organizations or those trying to minimize vendors often use only Epic. They struggle with external documents.
You Say:
Okay, so you're using Epic for everything - clinical records and documents.
How's that working for you when it comes to external documents -
faxes, scans, outside records?
Action: WAIT - They'll mention pain points
Common Pain Points:

"Manual work to get them into Epic"
"Epic scanning is clunky"
"No good way to handle high volumes"
"External documents just sit as attachments"

You Say:
Right, Epic is great as an EHR, but it's not really built to be a full
document management system. That's why a lot of organizations add OnBase or similar.

With Dexit, you might not need a separate DMS at all. Here's what we do:

Our AI handles intelligent document processing - classification, patient matching,
extraction - all automatically. We have workflow capabilities built in.
And we include a virtual fax server for inbound and outbound faxes.

Everything processes automatically and feeds into Epic already indexed.
So you get document management without adding OnBase-level complexity and cost.

Most organizations find this is a simpler, more cost-effective solution
than adding a traditional DMS. Want to see how it would work?
Key Positioning:

NOT adding complex DMS (OnBase requires admins, complex implementation)
Modern AI approach instead of traditional DMS
Works WITH Epic (not replacing)
Lower complexity than OnBase + Epic
Cost-effective (vs. OnBase licensing)

Next: Go to The Ask

EHR-Only Path
(Using Cerner/Meditech/Other with no separate DMS)
Type: 🟢 Strong Opportunity
Context: Similar to Epic-only but with non-Epic EHRs. Same pain points around external documents.
You Say:
Okay, so you're using [Cerner/Meditech] for everything.
When external documents come in - faxes, scans, outside records -
how are those being processed?
Action: WAIT
Expected: "Manually" or description of manual process
You Say:
Right, so that's all manual work. Here's what Dexit does:

Our AI automatically processes those external documents - classifies them,
extracts patient info, matches to patients, indexes everything.
Then feeds directly into [Cerner/Meditech] already processed.

We also include a virtual fax server with AI-powered routing,
so faxes get processed automatically too - no more fax machines.

You keep [Cerner/Meditech] for clinical workflows,
but eliminate the manual document processing work.
Most HIM teams get back 70-80% of their time.

Worth seeing how this integrates with your [Cerner/Meditech] environment?
Integration Note: Dexit integrates with any EHR via standard HL7 messaging (ADT for patient queries, MDM for document delivery).
Next: Go to The Ask

Pitch: Dexit Solution
(Use when they ask "Tell me more" or when appropriate)
Type: 🟣 Full Value Proposition
Context: This is your complete pitch. Use when they've shown interest and want to understand the full solution.
You Say:
Here's what makes Dexit different:

First, we have DextractLM - a large language model purpose-built for healthcare documents.
It's already trained on thousands of healthcare documents, so it understands
what a lab result looks like, what a referral is, how to extract clinical data.
No configuration needed - it works immediately.

Second, it learns continuously. Every time your team corrects something,
the AI learns from it. So accuracy improves over time for YOUR specific documents
and providers.

Third, we include a virtual fax server. Inbound and outbound faxes,
AI-powered routing, no more fax machines. All automated.

Fourth, we have flexible workflows you build yourself with drag-and-drop -
no coding needed.

And finally, we integrate with any EHR - Epic, Cerner, Meditech, whatever you're using.

Most HIM teams see 70-80% reduction in manual processing time.
Your team only reviews the 10-20% that actually need human judgment.
Everything else just processes itself.

Worth seeing how this would work in your environment?
Key Points Summary:

DextractLM™ - Purpose-built healthcare LLM
Continuous Learning - Improves with every correction
Virtual Fax Server - Built-in, AI-powered
Flexible Workflows - Drag-and-drop, no coding
EHR Agnostic - Works with any system
70-80% Time Savings - Only 10-20% need human review

Next: Go to The Ask

The Ask
Type: 🎯 Critical Moment - Requesting the Meeting
Context: This is where you convert interest into a scheduled demo. Be clear, confident, and give options.
You Say:
Let me connect you with one of our specialists who can show you exactly how this works
with your [Epic/Cerner/Meditech] and [OnBase/Gallery/current setup].
Usually takes about 20 minutes.

What does your schedule look like - this week or next?
Action: WAIT for response
Why This Works:

Specific - "20 minutes" (not vague "quick call")
Customized - References their specific systems
Options - This week or next (assumptive close)
Not pushy - Consultative tone

If they give availability:
Type: 🟢 Success - Meeting Set!
You Say:
Perfect. I'll send you a calendar invite for [day/time] to [their email].
You'll meet with [SME name] and they'll show you exactly how the AI processes documents
in your environment. If it makes sense to include anyone else from your team -
maybe IT or your director - feel free to add them. Sound good?
Action:

Get email confirmation
Confirm date/time
Note their name correctly
Thank them
End call professionally

Follow-up Actions:

Send calendar invite immediately
Send confirmation email with what to expect
Update CRM with conversation details
Set reminder to confirm 1 day before

✅ MEETING SET - Mark as success in CRM

If they hesitate:
Type: 🟠 Objection Pending
You Say:
No pressure - just a quick look at what's possible. If it's a fit, great.
If not, you at least see what modern document processing with AI looks like.
Twenty minutes - fair?
Why This Works:

Removes pressure - "no obligation" framing
Educational angle - "see what's possible"
Low commitment - Only 20 minutes
Fair exchange - They get value from learning

Responses:

If still hesitant: Go to Objection Handling
If they agree: Go back to scheduling

Objection Handling
Context: This section handles common objections. Stay calm, empathetic, and consultative. Don't argue or get defensive.
OBJECTION: "Not Interested"
Type: 🔴 Hard Objection
You Say:
No problem. Can I ask - is it that you're happy with how things work now,
or just not the right time?
Action: WAIT - Understanding the real reason helps
Why This Works: Uncovering whether it's a process issue or timing issue changes your response.

Branch A: "Just not the right time" / "Too busy"
Type: 🟠 Soft Objection - Timing
You Say:
Fair enough. When would make more sense - couple months from now?
If they give a timeframe:
Okay, I'll reach back out in [timeframe]. In the meantime,
should I send you some quick info so you have it when the timing's better?
Action:

Get email
Send information
Set follow-up reminder in CRM
End call politely

✅ Mark as "Follow-up [Date]" in CRM

Branch B: "We're happy with current process" / "We're all set"
Type: 🟠 Challenge - Usually not actually true
You Say:
That's good to hear. Just curious - your team isn't spending time
manually classifying and indexing documents anymore?
Because if you figured that out, I'd love to know how.
Action: WAIT - They'll admit they still do manual work
Why This Works: You're gently challenging their "we're fine" by asking about specifics.
Expected: They'll say "Well, we still do some manual work..."
You Say:
Right. So you're 'all set' in that you've got a process that works,
but it's still manual work, right?

What if I could show you how to cut that manual time by 70-80%?
Twenty minutes to see what full automation looks like.
Even if you don't change anything, you'll know what's possible. What do you say?
Responses:

If yes: Go to The Ask
If still no:

No worries. Can I at least send you some info so you have it for reference?

Get email, end call politely
✅ Mark as "Send Info" in CRM

OBJECTION: "Send Me Information"
Type: 🟠 Stall Tactic - Often means "get me off the phone"
Context: Email rarely converts. Try to get meeting first, then send info.
You Say:
I can send something, but honestly it's hard to appreciate on paper.
This is really visual - seeing the AI read a document in real time is what makes it click.

How about this: 20-minute demo where you see it working with your actual documents,
THEN I'll send you everything. That way the info actually makes sense.
Does Thursday or Friday work better?
Why This Works:

Acknowledges request (doesn't ignore it)
Explains why demo is better (visual, not theoretical)
Offers both (demo THEN info)
Gives specific options (Thursday/Friday)

If they insist on info first:
Type: 🟠 Persistent Stall
You Say:
Okay, I get it. What's your email? And what should I focus on -
how it handles classification, patient matching, the workflow piece,
or integration with [their EHR/DMS]?
Action: Get email and specific interests
Why Ask About Focus: Shows you're customizing, not sending generic brochure. Also keeps conversation going.
Then:
Got it. I'll send that over today. Can we at least tentatively get 20 minutes
on your calendar for next week? If the info doesn't resonate,
you can always cancel. Fair?
Responses:

If yes: Get tentative time, send invite
If no:

Okay, I'll send it over. I'll follow up in a couple days to see if you had
questions and if a quick demo makes sense. Sound good?
Action:

Send customized information
Set follow-up reminder (2-3 days)
✅ Mark as "Info Sent - Follow Up [Date]" in CRM

OBJECTION: "I'm Not the Decision Maker"
Type: 🟠 Common Objection - Handle strategically
Context: HIM managers/directors often say this, but their input matters. Don't give up.
You Say:
I totally get it - these decisions usually involve a few people.
But here's why I wanted to talk to you specifically: you're in the trenches every day, right?
You know exactly what's working and what's not.

When your organization does evaluate solutions like this,
your input is going to matter because you're the one who'll actually be using it.

How about this: see it for yourself first - 20 minutes.
If it looks like something that could help your team, you'll know exactly what to say
when those conversations come up. If not, no harm done. Fair?
Why This Works:

Validates their role - "your input matters"
Positions them as influencer - Not decision maker, but important voice
Low pressure - Just seeing it for themselves
Empowers them - Gives them info to bring to decision makers

If they still resist:
You Say:
No problem. Who else would typically be involved in a decision like this -
your director, IT, Revenue Cycle?
Action: Get names
Then:
Would it make sense to have them on the demo too, or would you want to see it first
and then bring it to them?

Branch A: "Let's include them"
Type: 🟢 Better Opportunity - Multiple stakeholders
You Say:
Perfect. Let me get a time that works for everyone.
What's the best way to coordinate that - should I reach out to them,
or would you prefer to set it up?
Action:

If they'll coordinate: Get their email, have them send availability
If you should coordinate: Get contact info for other stakeholders

✅ Mark as "Multi-Stakeholder Meeting" in CRM

Branch B: "I'll look at it first"
Type: 🟢 Good Outcome
You Say:
Great. Let's get you on a quick demo - 20 minutes.
If it makes sense, you can loop them in after.
What's your availability this week?
Next: Go to The Ask

OBJECTION: "How Much Does It Cost?"
Type: 🟠 Price Question - Too early to quote
Context: Don't give pricing on cold call. You don't have enough info, and it becomes the focus instead of value.
You Say:
Fair question. It's based on your volume and what you need.
For most HIM departments your size, when you look at the time savings versus the cost,
it pays for itself pretty quickly.

Here's what makes more sense: let me get you on a call with our specialist.
They can show you what it does AND give you real numbers based on your volume.
Then you can decide if the math works. Sound fair?
Why This Works:

Acknowledges question (not deflecting)
Explains pricing model (volume-based, custom)
Frames ROI (pays for itself)
Defers to specialist (who can give accurate quote)
Offers value (see it AND get pricing)

If they push for a number:
Type: 🟠 Persistent Price Objection
You Say:
I don't want to throw out a number that's not accurate for your situation.
It depends on how many documents you're processing, which modules you need,
and your integration requirements.

But I can tell you it's subscription-based, so you're not making a massive capital investment.
And most organizations find the ROI is there within the first few months
because of the staff time saved.

Let's get you on a demo where we can talk real numbers based on your specifics.
Does [day/time] work?
Key Points:

Don't quote without info - You'll either be too high or too low
Subscription model - Not huge upfront cost
ROI focus - Value, not just cost
Move to demo - Where pricing discussion belongs

OBJECTION: "We Just Renewed Our [OnBase/DMS] Contract"
Type: 🟠 Contract Lock-in
Context: They feel stuck with current vendor. Position as complementary, not replacement.
You Say:
Okay, so you're locked into [OnBase] for a while. That's actually fine -
we're not asking you to rip and replace it.

What we do is add an AI layer on TOP of [OnBase]. Documents get processed automatically
by our AI first, then feed into [OnBase] already classified and indexed.
[OnBase] stays for storage and workflows, but now your team isn't doing all that
manual front-end work.

So you get more value out of the [OnBase] investment you already made.
The contract you just renewed doesn't prevent you from adding intelligence on top of it.

Worth seeing how that would work?
Why This Works:

Not competitive - Complementary to their investment
Adds value - Makes their current system better
No rip-and-replace - Reduces perceived risk
Works with contract - Doesn't require breaking commitment

Next: Go to The Ask

OBJECTION: "We're Implementing [System] Right Now" / "We're Too Busy"
Type: 🟠 Timing/Bandwidth Objection
Context: They're in the middle of a project and feel overwhelmed.
You Say:
I totally get it - implementations are all-consuming.

Here's the thing though: when you go live on [new system],
your team is going to be drowning in documents that need processing, right?

Having automation like Dexit in place BEFORE go-live means you're not dealing with
that manual work during the most critical time.

Also, we can implement alongside your [system] project without disrupting it.
Different teams, different timelines.

At minimum, worth seeing how it works so you know what's possible
when things settle down after go-live. Twenty minutes now could save you
a lot of pain later. What do you think?
Why This Works:

Empathy - Acknowledges they're busy
Reframes timing - BEFORE go-live is actually BETTER
No disruption - Parallel implementation
Low commitment - Just seeing it
Future planning - Even if not now, good to know

OBJECTION: "We're Waiting for Epic Gallery"
Type: 🟠 Future Product Objection
Context: Epic has convinced them Gallery will solve everything. It won't.
You Say:
I hear you. Epic has been talking about Gallery for a while.
A few things to consider:

First, even when Gallery is fully available, it's designed primarily for clinical documents
already in Epic. External documents - faxes from non-Epic providers, scanned paper,
outside records - that's still going to require processing.

Second, Gallery doesn't have AI automation built in. Someone still has to classify
and index documents manually.

And third, while you wait - whether it's 6 months or 2 years -
your team is doing manual work every single day. That's time and money being lost.

Here's what we can do: Dexit works NOW and integrates with Epic.
When Gallery does come out, we can work alongside it or help you transition.
But why wait and keep doing manual work when you could be saving time today?

Plus, we can help with the Gallery migration when the time comes.
Make sense?
Why This Works:

Educates about Gallery limitations - Sets realistic expectations
Quantifies wait cost - Time and money lost while waiting
Offers flexibility - Works now, works with Gallery later
Migration help - Additional value proposition

Competitor Context - Epic Gallery (Detailed):

Timeline Uncertainty: Gallery has been "coming soon" for years, rollout is incremental
Limited Scope: Designed for Epic-created docs, not comprehensive DMS
No AI: Manual processing required
Non-Clinical Gap: Can't handle HR, Finance, Legal documents
Our Advantage: Available now, AI-powered, broader scope, can complement Gallery

OBJECTION: "We Have AI Features in [Current System]"
Type: 🟠 AI Parity Claim
Context: Their current system claims to have AI. Often it's basic or rule-based.
You Say:
Okay, so [system] has some AI capabilities. Can I ask -
is that working well, or are there still accuracy issues or manual corrections needed?
Action: WAIT - They'll usually mention issues
Listen For:

Accuracy complaints
Lots of exceptions
Manual corrections needed
Maintenance burden

You Say:
Right. Here's the difference: a lot of systems have added AI features,
but it's not their core competency. They're adapting general AI for healthcare.

Dexit has DextractLM - a large language model purpose-built SPECIFICALLY for
healthcare documents from the ground up. We're not adapting technology -
healthcare document intelligence IS what we do.

Plus, our AI learns continuously from your corrections.
Most systems are more static or require periodic retraining.

Worth seeing the difference in accuracy and how much less maintenance is needed?
Key Distinction:

Their AI: Bolted on, adapted, or generic
Our AI: Purpose-built, healthcare-specific, core competency
Their Learning: Static or periodic retraining
Our Learning: Continuous, automatic improvement

OBJECTION: "We're Looking at [Competitor Name]"
Type: 🟢 Opportunity - They're actively evaluating
Context: They're in buying mode. Get included in their evaluation.
You Say:
That's smart - you should look at options. [Competitor] is a good solution.

If you're already evaluating, it's probably worth adding us to the comparison, right?
That way you're making sure you're picking the best option.

We're usually differentiated on three things:

One, our purpose-built healthcare AI - DextractLM is trained specifically on
healthcare documents, not adapted from other industries.

Two, continuous learning - our AI gets smarter with every correction your team makes.

And three, we're typically more cost-effective and faster to implement than
[enterprise competitors like Vyne/Brainware].

Worth adding us to your evaluation? It's just 20 minutes to see how we compare.
Why This Works:

Doesn't attack competitor - Acknowledges they're valid
Logical appeal - "If evaluating, should see all options"
Quick differentiators - Three key points
Low commitment - Just 20 minutes for comparison

Customization by Competitor:

vs. Vyne: "Vyne is strong for referrals. We handle all document types equally well with modern AI."
vs. Solarity: "Solarity is healthcare-focused like us. Key difference is our proven DextractLM and 314e's 20-year backing."
vs. Brainware: "Brainware is expensive on top of OnBase. We're more cost-effective with modern AI."

OBJECTION: "We Don't Have Budget"
Type: 🟠 Budget Objection
Context: Often means "not a priority" or "haven't justified cost yet."
You Say:
I totally get it - budget is always tight. Here's the thing though:
what you're spending on staff time to manually process documents - that's budget too, right?

When we save your team 5-10 hours a week, that's money you're getting back.
A lot of organizations find that the time savings actually pays for the system.

Let's at least see what it would look like. Our specialist can show you the cost
versus the time savings based on your volume. Then you can decide if it's worth
pursuing budget for. If the ROI isn't there, we'll both know. Fair?
Alternative Approach:
Fair enough. When does your next budget cycle open up? Even if there's no money right now,
it might make sense to see this so you can plan for it in next year's budget.
That way when the time comes, you've already got the business case built.
Why This Works:

Reframes budget - Current manual cost vs. system cost
ROI focus - Time savings = money
Future planning - Plant seeds for next budget cycle
Helps build business case - Give them ammo for budget request

OBJECTION: "We Need to Go Through Procurement / IT Security Review"
Type: 🟠 Process Objection
Context: Large organizations have formal processes. Don't fight it - work with it.
You Say:
Absolutely - that's expected in an organization your size. We've been through
procurement and security reviews with dozens of healthcare organizations.

Here's what usually works: let's get you on a demo first so you know if it's
even worth starting those processes. If it's a fit functionally,
then we engage with procurement and security and provide whatever they need.

We're SOC 2 Type 2 certified, HIPAA compliant, and we've got all the
security documentation ready to go. But no point starting that process
if the solution doesn't fit your needs, right?

Twenty minutes to see if it's worth pursuing. What do you think?
Why This Works:

Acknowledges their process - Respects organizational requirements
Logical sequence - Demo first, then formal process
Security credibility - SOC 2, HIPAA compliance
Efficiency - Don't waste time on process if it's not a fit

OBJECTION: "Our Staff Won't Want to Change" / "Change Management Concerns"
Type: 🟠 Adoption Objection
Context: They're worried about user resistance.
You Say:
That's a legitimate concern - change is always hard. But here's what's different:
we're not asking your staff to change their process. We're eliminating work they don't want to do.

Right now, they're opening every document, classifying it, matching to patients, indexing -
that's repetitive, tedious work. Nobody WANTS to do that.

With Dexit, that work just...stops. Documents show up already processed.
They only look at the exceptions. Less work, same or better outcomes.

In our experience, this is one of the easiest changes to adopt because
we're taking away pain, not adding complexity.

Worth seeing how the user experience would change for your team?
Why This Works:

Reframes change - Not changing process, eliminating work
Focuses on pain relief - Taking away tedious tasks
User benefit - Staff do less work
Track record - "In our experience..." = social proof

Closing Statements
Context: How to professionally end calls in different scenarios.
When Ending a Successful Call (Meeting Set):
Type: 🟢 Success
You Say:
Perfect, [Name]. You'll get a calendar invite from me today for [day/time].
You'll meet with [SME name] and they'll show you exactly how this works
with your [Epic/Cerner] and [OnBase/current setup].

If you think of any questions before then, feel free to email me at [your email].
Looking forward to it!
Action:

Send calendar invite within 1 hour
Send confirmation email with prep info
Update CRM with detailed notes
Set reminder to confirm 1 day before demo

When Ending Without Meeting (But Positive):
Type: 🟠 Warm Lead
You Say:
No worries, [Name]. I'll send you that information today.
I'll check back with you in a couple days to see if you have questions
and if a quick demo makes sense.

Feel free to reach out if anything comes up before then. Have a great day!
Action:

Send customized information within 2 hours
Set follow-up reminder (2-3 days)
Update CRM with next steps
Note what information they requested

When Ending After Hard "No":
Type: ❌ Dead End (For Now)
You Say:
No problem, [Name]. I appreciate your time. If anything changes down the road,
feel free to reach out. Have a good one!

**Action:**

- Update CRM as "Not Interested - [Reason]"
- Set long-term follow-up (6-12 months) if appropriate
- Move on professionally
- Don't take it personally

---

## Quick Reference

**Context:** Key information for easy reference during calls.

### Dexit's Core Differentiators:

1. ✅ **DextractLM™** - Purpose-built healthcare LLM (not adapted from other industries)
2. ✅ **Continuous Learning** - AI improves automatically from corrections
3. ✅ **70-80% Time Savings** - Only 10-20% of documents need human review
4. ✅ **Virtual Fax Server** - Built-in, AI-powered fax routing (inbound/outbound)
5. ✅ **EHR Agnostic** - Works with Epic, Cerner, Meditech, any EHR
6. ✅ **Complements Existing Systems** - Works WITH OnBase/Gallery, not replacing
7. ✅ **Subscription Pricing** - Not massive capital investment
8. ✅ **20+ Years** - 314e healthcare IT experience

---

### Against OnBase:

- **OnBase Strengths:** Storage ✅, Workflow ✅, Enterprise-proven ✅
- **OnBase Limitations:** No AI ❌, Manual indexing required ❌, Keyword rules brittle ❌
- **Dexit Advantage:** AI intelligence for front-end processing, works WITH OnBase

---

### Against Brainware:

- **Cost:** Expensive add-on ($50K-$200K+) ❌
- **Technology:** Built before modern AI ⚠️
- **Maintenance:** Requires training and retraining ⚠️
- **Dexit Advantage:** Modern LLM, pre-trained, continuous learning, more cost-effective ✅

---

### Against Epic Gallery:

- **Gallery Strengths:** Epic integration ✅, Good for Epic clinical docs ✅
- **Gallery Limitations:** No AI ❌, Not for external/non-clinical docs ❌, Still maturing ⚠️
- **Dexit Advantage:** AI processing + handles non-clinical + migration help ✅

---

### Against Vyne:

- **Vyne Strengths:** Strong for referrals ✅, Established presence ✅
- **Vyne Limitations:** Referral-focused ⚠️, AI bolted on ⚠️, Enterprise pricing ❌
- **Dexit Advantage:** All document types, modern AI, flexible pricing ✅

---

### Against Solarity:

- **Solarity Strengths:** Healthcare-focused ✅, Has AI/ML ✅
- **Solarity Unknowns:** Smaller company ⚠️, AI sophistication unclear ⚠️
- **Dexit Advantage:** DextractLM proven, 314e backing, continuous learning ✅

---

## Voicemail Script

**Context:** Leave this message when you reach voicemail. Keep it under 30 seconds.

**You Say:**
Hi [Name], this is [First] from 314e. We have an AI-powered document processing system
that automates classification, patient matching, and indexing for HIM teams -
so your staff isn't doing it all manually.
Most HIM departments are seeing 70-80% time savings.
I'll send you a quick email, but if you want to see how the system works,
feel free to grab time on my calendar. My number is [number].
Again, [First] from 314e at [number]. Thanks!

**Key Elements:**

- **Who you are** - Name and company
- **What you do** - Automate document processing
- **Key benefit** - 70-80% time savings
- **Next step** - Email + calendar link
- **Contact info** - Phone number (twice)

**Action After Leaving Voicemail:**

- Send follow-up email within 1 hour
- Include calendar link
- Set reminder to call again (3-5 days if no response)

---

## Follow-up Email Template

**Subject:** AI Document Processing for [Hospital Name] HIM
Hi [Name],
[Your Name] from 314e - we spoke briefly today / I left you a voicemail about automating document processing.
Here's what we do in 30 seconds:
Our AI (DextractLM) automatically:

Classifies documents (lab results, referrals, clinical notes, etc.)
Extracts patient demographics
Matches to your MPI
Indexes with full metadata

Your team only reviews the 10-20% that need extra attention.
Most HIM departments get back 70-80% of the time they were spending on manual indexing.
We work with [Epic/Cerner/Meditech], integrate with OnBase/Gallery/any DMS,
and include a virtual fax server with AI-powered routing.
Worth 20 minutes to see how this works in your environment?
[CALENDAR LINK]
Or reply with questions.
Best,
[Your Name]
[Title]
314e Corporation
[Phone] | [Email]

**Customization Tips:**

- **Subject:** Include their hospital name
- **Opening:** Reference if you spoke or left voicemail
- **Systems:** Mention their specific EHR/DMS if you know it
- **Calendar Link:** Use Calendly or similar booking tool
- **Signature:** Professional, with contact info

---

**END OF CALL FLOW SCRIPT**

---

This complete script provides the interactive flowchart structure for a web application. Each section has clear branching logic, competitor information, and specific responses based on prospect answers.
