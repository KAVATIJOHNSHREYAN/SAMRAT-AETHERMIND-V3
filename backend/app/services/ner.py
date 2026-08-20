import re
import spacy
from typing import Dict, List, Set

nlp = None
try:
    nlp = spacy.load("en_core_web_sm")
except Exception as e:
    print(f"Warning: Failed to load spaCy model 'en_core_web_sm'. Using fallback regex rules. Error: {e}")

COMMON_SKILLS = {
    "python", "javascript", "typescript", "react", "next.js", "node.js", "vue",
    "fastapi", "django", "flask", "postgresql", "mongodb", "redis", "docker",
    "kubernetes", "aws", "gcp", "azure", "ci/cd", "git", "sql", "nosql",
    "machine learning", "deep learning", "nlp", "pytorch", "tensorflow",
    "html", "css", "tailwind", "rest api", "graphql", "agile", "scrum",
    "project management", "java", "c++", "c#", "go", "rust", "ruby"
}

def extract_entities(text: str) -> Dict[str, List[str]]:
    """
    Extracts key information from text: names, organizations, dates, locations,
    contact info (emails, phones), and technology skills.
    """
    entities = {
        "names": [],
        "organizations": [],
        "locations": [],
        "dates": [],
        "emails": [],
        "phones": [],
        "skills": []
    }

    if not text:
        return entities

    # Extract email addresses using regex
    email_pattern = r'[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+'
    entities["emails"] = list(set(re.findall(email_pattern, text)))

    # Extract phone numbers using regex
    phone_pattern = r'(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}'
    entities["phones"] = list(set(re.findall(phone_pattern, text)))

    # Match skills using word boundaries
    matched_skills: Set[str] = set()
    text_lower = text.lower()
    for skill in COMMON_SKILLS:
        pattern = rf'\b{re.escape(skill)}\b'
        if re.search(pattern, text_lower):
            matched_skills.add(skill.title())
    entities["skills"] = list(matched_skills)

    # Use spaCy NER if available
    if nlp:
        try:
            doc = nlp(text)
            names = set()
            orgs = set()
            gpes = set()
            dates = set()

            for ent in doc.ents:
                val = ent.text.strip().replace("\n", " ")
                if len(val) < 2:
                    continue
                if ent.label_ == "PERSON":
                    # Exclude emails or symbols if misidentified
                    if "@" not in val and not re.search(r'[()\[\]{}]', val):
                        names.add(val)
                elif ent.label_ == "ORG":
                    orgs.add(val)
                elif ent.label_ in ["GPE", "LOC"]:
                    gpes.add(val)
                elif ent.label_ == "DATE":
                    dates.add(val)

            entities["names"] = list(names)[:5] # Cap top 5 names
            entities["organizations"] = list(orgs)[:10]
            entities["locations"] = list(gpes)[:10]
            entities["dates"] = list(dates)[:10]
        except Exception as e:
            print(f"spaCy NLP parsing exception: {e}")

    # Simple regex fallback if spaCy is missing or failed
    if not entities["names"]:
        # Look for potential capitalized name lines at the start of resume
        lines = [line.strip() for line in text.split("\n") if line.strip()]
        for line in lines[:3]:
            if re.match(r'^[A-Z][a-z]+\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?$', line):
                entities["names"].append(line)
                break

    return entities

