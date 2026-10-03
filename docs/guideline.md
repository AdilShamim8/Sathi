# AI DEV FEST 2026: CODE INNOVATE INTELLIGENT FUTURE
## { HACKATHON } Project Guideline & Innovation Playbook

**Organizers & Affiliations:**
* **উপায় (upay)** – একটি UCB প্রতিষ্ঠান (A UCB Institution)
* **Daffodil International University (DIU)** – Department of Computer Science and Engineering
* **DIU CPC** – Computer & Programming Club

---

### THE CHALLENGE
> **Do not build AI for the sake of AI.** Start with a real user or business problem, then use AI where it creates a defensible advantage. Identify a meaningful problem in digital financial services, design a useful product, and build a working prototype that could become relevant to the future of upay.
> 
> *For DIU students*  
> *Organized by DIU CPC × upay*  
> *Build meaningful AI solutions for the future of digital financial services*

---

## 1. Purpose of the Challenge

The AI Hackathon is designed as a product-oriented innovation program. Students are expected to move from problem discovery to AI solution design, working prototype, measurable impact, and a clear path toward future validation.

### WHAT MAKES THIS DIFFERENT
> The objective is not to produce a generic chatbot, a dashboard, or a model accuracy score. The objective is to discover ideas that can improve trust, customer value, financial independence, ecosystem performance, growth, or operational efficiency in a modern MFS.

### Program Principles
* **Customer-first:** Every project should create a clear benefit for a customer, merchant, agent, or internal user.
* **AI with purpose:** AI must perform a meaningful prediction, recommendation, detection, optimization, generation, or intelligent automation task.
* **Build, do not only pitch:** A functional prototype is expected.
* **Privacy by design:** No production customer data is required or provided during the hackathon.
* **Future-ready:** Teams should explain how the idea could be validated with controlled upay data after the competition.
* **Responsible innovation:** High-impact decisions should remain explainable, secure, and subject to appropriate human oversight.

### What Students Should Learn
* How to identify real product problems in financial services.
* How to create useful synthetic or public-data-driven prototypes.
* How to combine machine learning, generative AI, analytics, and software engineering.
* How to measure business and customer impact — not just model performance.
* How to communicate an AI product to technical, business, and executive audiences.

---

## 2. Future-Focused Challenge Tracks

Students may select one track or propose a closely related MFS problem. The tracks below are deliberately broad enough to encourage innovation while keeping the challenge connected to future upay capabilities.

| Track | Future Capability | What Students Can Build | Why It Matters to upay |
| :--- | :--- | :--- | :--- |
| **01. Trust & Risk Intelligence** | Protect digital money | Fraud detection, scam intelligence, account takeover, mule networks, agent risk | Trust is foundational to wallet adoption and transaction growth. |
| **02. Customer Intelligence** | Understand customers deeply | Customer 360, churn, segmentation, next-best-action, personalization | Enables better service, retention, and product decisions. |
| **03. Customer Innovation & Financial Independence** | Help customers become more capable | Financial health, savings goals, spending intelligence, financial coaching, inclusive UX | Creates differentiated customer value beyond basic payments. |
| **04. Growth & Campaign Intelligence** | Make growth more intelligent | Next-best-offer, uplift modeling, campaign optimization, lifecycle marketing | Improves marketing efficiency and incremental transaction growth. |
| **05. Merchant & Agent Intelligence** | Strengthen the MFS ecosystem | Demand forecasting, merchant growth, agent liquidity, agent risk, benchmarking | Improves ecosystem productivity and service availability. |
| **06. Operations & Service Intelligence** | Make operations faster and smarter | Dispute investigation, support copilot, complaint intelligence, workflow automation | Reduces operational effort while improving customer experience. |
| **07. Open Innovation** | Create the unexpected | Any responsible AI solution for an MFS challenge | Allows students to discover opportunities outside predefined categories. |

---

## 3. Track 01: Trust & Risk Intelligence

Build AI systems that protect customers, transactions, merchants, agents, and the MFS ecosystem from fraud, scams, abnormal activity, and emerging risks.

### Challenge Directions
* **Real-time transaction risk scoring:** Estimate the probability that a transaction is suspicious.
* **Behavioral anomaly detection:** Learn a user's normal transaction pattern and identify significant deviations.
* **Account takeover intelligence:** Identify unusual device, location, timing, recipient, or velocity patterns.
* **Money-mule and suspicious-network discovery:** Use transaction graphs to identify connected risky wallets or entities.
* **Agent risk intelligence:** Detect unusual agent behavior relative to peers and historical patterns.
* **Scam intelligence:** Identify patterns associated with social-engineering or scam-related transactions.
* **AI investigation assistant:** Explain why an alert was generated and summarize the evidence for an analyst.

### Suggested AI Methods
| Problem | Possible Approach |
| :--- | :--- |
| **Transaction classification** | XGBoost / LightGBM / neural classifier |
| **Behavioral anomaly** | Isolation Forest / Autoencoder / clustering |
| **Network risk** | Graph analytics / Graph ML |
| **Explanation** | SHAP / feature attribution / rule trace |
| **Investigation narrative** | RAG or LLM grounded in structured evidence |

### GOOD PROJECT TEST
> A strong project can answer three questions: **What happened? Why is it risky? What should upay do next?**

---

## 4. Track 02: Customer Intelligence

Build systems that help upay understand customer needs, behavior, lifecycle, and likely next actions.

### Project Opportunities
* **Customer 360 intelligence:** Create a concise behavioral profile from synthetic transaction and engagement data.
* **Churn prediction:** Identify customers likely to become inactive and explain the drivers.
* **Behavioral segmentation:** Discover meaningful customer segments and describe their needs.
* **Next-best-action:** Recommend the most relevant action for a customer at a given point in their lifecycle.
* **Customer lifetime value prediction:** Estimate expected future value and prioritize retention investment.
* **Personalized service recommendations:** Identify services or features that are relevant to different customer profiles.

### What Makes a Strong Solution?
* It connects a prediction to a practical action.
* It avoids treating all customers the same.
* It measures whether the recommended action changes behavior.
* It provides transparent reasons for recommendations.

---

## 5. Track 03: Customer Innovation & Financial Independence

This is a flagship differentiation track. The goal is to move beyond "payments" and explore how AI can help people make better financial decisions, become more self-directed, and get more value from digital financial services.

### THE BIG QUESTION – CUSTOMER INNOVATION
> **How might an MFS platform help customers become more financially confident and independent — not merely more active users?**

### Project Opportunities
* **AI Financial Health Coach:** Explain spending behavior, cash dependency, and financial habits in simple language.
* **Personal Savings Planner:** Turn a customer goal into a realistic savings plan based on simulated cash-flow behavior.
* **Smart Spending Companion:** Identify unusual or avoidable spending patterns and suggest practical actions.
* **Cash-Flow Forecasting:** Predict likely short-term inflows, outflows, and liquidity pressure.
* **Financial Goal Copilot:** Help users plan for education, emergency funds, travel, devices, family needs, or other goals.
* **Inclusive Financial Assistant:** Use voice, Bangla-friendly language, or simplified UX to improve accessibility.
* **Financial Literacy Personalizer:** Adapt educational guidance based on a user's demonstrated behavior rather than generic content.
* **Responsible Credit Readiness:** Create explainable signals that help a customer understand how consistent financial behavior may affect future eligibility, without making autonomous lending decisions.

### Example Experience
| User says | AI could respond |
| :--- | :--- |
| *"I need to save ৳30,000 in six months."* | Build a target plan, identify feasible monthly contributions, and show trade-offs. |
| *"Why do I always run short before month-end?"* | Explain the recurring cash-flow pattern and identify the weeks with the largest outflows. |
| *"How can I reduce cash-outs?"* | Identify where digital alternatives could plausibly replace repetitive cash withdrawal behavior. |
| *"I don't understand these transactions."* | Translate the transaction pattern into simple categories and plain-language insights. |

### IMPORTANT
> Projects in this track should empower the customer. Avoid manipulative recommendations, hidden fees, or designs that encourage unnecessary spending. The objective is informed choice and sustainable financial behavior.

---

## 6. Track 04: Growth & Campaign Intelligence

Build AI systems that help an MFS grow efficiently by identifying the customers, merchants, offers, timing, and interventions most likely to create incremental value.

### Project Opportunities
* **Next-best-offer engine:** Rank offers for customers based on predicted relevance.
* **Campaign response prediction:** Estimate who is likely to respond to a campaign.
* **Uplift modeling:** Identify customers whose behavior is most likely to change because of an intervention.
* **Campaign budget optimizer:** Allocate a fixed budget across audiences or offers to maximize incremental outcomes.
* **Lifecycle orchestration:** Recommend the next engagement step across acquisition, activation, retention, and win-back stages.
* **Offer fatigue detection:** Identify when repeated campaigns are becoming less effective or annoying for users.
* **Experiment intelligence:** Compare campaign variants and recommend what to test next.

### ADVANCED IDEA
> A mature project should distinguish correlation from incremental impact. *"This customer will transact"* is weaker than *"this customer is likely to transact because of the offer."*

---

## 7. Track 05: Merchant & Agent Intelligence

Treat merchants and agents as intelligent nodes in the MFS ecosystem. Help them predict demand, improve performance, and deliver better customer service.

### Project Opportunities
* **Merchant demand forecasting:** Predict transaction demand by day, hour, location, or category.
* **Merchant growth recommendations:** Recommend actions to increase repeat usage and transaction value.
* **Merchant churn prediction:** Identify merchants at risk of becoming inactive.
* **Merchant benchmarking:** Compare performance against similar peers and explain gaps.
* **Agent liquidity forecasting:** Predict future cash-out demand and likely liquidity pressure.
* **Agent performance intelligence:** Identify service gaps, emerging high performers, or abnormal patterns.
* **Location intelligence:** Identify where additional merchant or agent coverage could create value.

---

## 8. Track 06: Operations & Service Intelligence

Use AI to reduce manual work, speed up investigation, and improve the consistency of operational decisions.

### Project Opportunities
* **Transaction dispute investigator:** Reconstruct transaction events and identify probable root causes.
* **Customer support copilot:** Summarize the customer context and propose the next best operational response.
* **Complaint intelligence:** Classify complaints, detect themes, and identify systemic issues.
* **Operations anomaly monitor:** Detect unusual changes in service volumes or failure patterns.
* **Knowledge assistant:** Answer questions from approved operational documents using retrieval-augmented generation.
* **Workflow automation assistant:** Recommend which team or workflow should receive a case and why.

---

## 9. Track 07: Open Innovation

Students are encouraged to challenge the assumptions behind today's MFS experience. Any responsible AI idea is welcome when there is a credible customer or business problem.

### Open Innovation Prompts
* What financial problem do people still solve manually even though they use a mobile wallet?
* What prevents a user from becoming a more digitally confident customer?
* What MFS service could be radically personalized?
* What would make digital finance safer for first-time or vulnerable users?
* What could AI automate for a merchant, agent, or operations team that is currently repetitive?
* What new product could be created if transaction intelligence were available in a privacy-preserving way?

### DO NOT SELF-LIMIT
> You are not required to copy an existing fintech feature. The strongest open-innovation projects may redefine the problem rather than improve a familiar workflow.

---

## 10. Student Idea Development Framework

Before writing code, every team should complete this one-page logic chain.

| Step | Question to answer | Evidence expected |
| :--- | :--- | :--- |
| **1. User** | Who experiences the problem? | Customer / merchant / agent / operations persona |
| **2. Problem** | What is difficult, costly, risky, or frustrating? | Clear problem statement and baseline |
| **3. Why now** | Why could AI help now? | Data / AI opportunity |
| **4. Solution** | What exactly are you building? | Product flow / prototype concept |
| **5. AI role** | What is the model doing? | Prediction / recommendation / detection / generation / optimization |
| **6. Impact** | What outcome should improve? | Metric and target |
| **7. Data** | What data can you safely simulate or source? | Synthetic / public data strategy |
| **8. Validation** | How will you know it works? | Offline metric + user / business experiment |
| **9. Scale** | What changes when real data becomes available? | Integration and governance plan |

### Recommended Problem Statement Format
> #### TEMPLATE
> "For **[specific user]**, **[specific problem]** causes **[measurable consequence]**. We will build **[AI-powered product]** that uses **[data]** to **[decision/action]**, with success measured by **[metric]**."

---

## 11. Data Strategy: No Production Data Required

To protect customer privacy and keep the competition accessible, teams should develop using synthetic data, public datasets where appropriate, or their own simulations. Production upay data is not required for the hackathon.

### Recommended Synthetic Data Domains
* Customers and basic behavioral attributes
* Transactions and transaction types
* Merchants and merchant categories
* Agents and agent activity
* Devices, locations, timestamps, and channels
* Campaigns, offers, treatment/control labels
* Cases, complaints, and operational events

### Synthetic-Data Principles
* Make the data realistic enough to reproduce meaningful patterns, but clearly synthetic.
* Inject known patterns for testing: normal behavior, anomalies, seasonal effects, campaign response, churn, etc.
* Document every synthetic assumption.
* Never use real personally identifiable information to improve realism.
* Keep a clean test set that is not used to train the model.

### POST-HACKATHON PATH
> Selected solutions may be considered for controlled validation using appropriately governed, anonymized, or aggregated data. This is a potential follow-on stage — not a promise of access or deployment.

---

## 12. Suggested Technical Architecture

Teams may use any reasonable technology stack. The following architecture is a reference — not a requirement.

| Layer | Stack Examples | Purpose |
| :--- | :--- | :--- |
| **Data** | Python, Pandas, PostgreSQL etc. | Synthetic data generation, storage, feature preparation |
| **ML** | Scikit-learn, XGBoost, LightGBM, PyTorch etc. | Prediction, classification, anomaly detection |
| **GenAI** | LLM + RAG framework etc. | Natural-language reasoning, explanation, summarization |
| **API** | FastAPI / Node.js etc. | Expose model capabilities as services |
| **Frontend** | React / Next.js etc. | Customer, analyst, merchant, or admin experience |
| **Monitoring** | Logs, metrics, model dashboards etc. | Observe performance and explain decisions |

### Reference Architecture Flow
$$\text{INPUT} \longrightarrow \text{INTELLIGENCE} \longrightarrow \text{ACTION}$$

```
Synthetic/public data feature & context layer 
    → ML/AI engine explanation/recommendation 
    → user or operator action 
    → measurable outcome feedback loop
```

### Architecture Expectations
* Separate data preparation from model inference where possible.
* Keep business rules distinct from machine-learning predictions.
* Make model outputs traceable and explainable.
* Design APIs so the prototype could later be connected to a real backend.
* Do not put sensitive decision logic entirely inside a free-form LLM prompt.

---

## 13. From Project to Product

The strongest teams will think beyond the competition. A prototype becomes a product candidate when it has a clear user, repeatable value, manageable risk, and a believable path to production.

### Product Readiness Checklist
- [ ] User problem is frequent or economically meaningful.
- [ ] AI adds value beyond a simple deterministic rule.
- [ ] There is a clear action after the prediction or recommendation.
- [ ] The business benefit can be measured.
- [ ] The model can be validated with future real-world data.
- [ ] Privacy, fairness, explainability, and security can be addressed.
- [ ] The system can integrate into a real digital-service workflow.

### Post-Hackathon Pathway
| Stage | Outcome |
| :--- | :--- |
| **1. Competition** | Prototype + pitch + evidence |
| **2. Technical review** | Model quality, architecture, security, feasibility |
| **3. Business review** | Customer value, strategic relevance, economics |
| **4. Controlled validation** | Potential access to suitable governed data for selected projects |
| **5. POC** | Test with real operational context |
| **6. Pilot assessment** | Measure impact, risk, scalability, and adoption |
| **7. Next decision** | Integrate, incubate, partner, or close |

---

## 14. Responsible AI & Safety Requirements

Fintech AI can influence trust, access, money movement, and customer decisions. Teams must design responsibly.

| Principle | Minimum Expectation |
| :--- | :--- |
| **Privacy** | Use only synthetic/public/self-generated data during the hackathon. |
| **Explainability** | Show the main reasons behind important predictions. |
| **Fairness** | Check whether the model behaves differently across relevant groups. |
| **Security** | Consider adversarial manipulation, prompt injection, data leakage, and access control. |
| **Human oversight** | High-impact actions should allow appropriate human review. |
| **Transparency** | Clearly separate predictions, assumptions, and generated explanations. |
| **No harmful automation** | Do not autonomously approve/deny consequential financial decisions without appropriate controls. |

---

## 15. Evaluation Framework

Judges should reward solutions that combine meaningful MFS relevance with strong technical execution and product thinking.

| Criterion | Weight | What Good Looks Like |
| :--- | :---: | :--- |
| **Problem relevance** | **20%** | Solves a real and meaningful customer/business problem |
| **AI/ML depth** | **20%** | AI is material to the solution and technically credible |
| **Business/customer impact** | **20%** | Clear, measurable value and plausible economics |
| **Prototype quality** | **15%** | Working end-to-end experience, not only slides |
| **Innovation** | **10%** | Distinctive insight or differentiated product idea |
| **Scalability & integration** | **10%** | Believable path toward real systems and future data |
| **Responsible AI & security** | **5%** | Privacy, explainability, fairness, and safety considered |