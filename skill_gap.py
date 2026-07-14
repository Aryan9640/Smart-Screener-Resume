import re

COMMON_SKILLS = [
    "python", "java", "javascript", "typescript", "sql", "nosql", "mongodb", "postgresql",
    "mysql", "react", "angular", "vue", "node.js", "django", "flask", "spring", "aws", 
    "azure", "gcp", "docker", "kubernetes", "jenkins", "git", "agile", "scrum", "machine learning",
    "deep learning", "nlp", "computer vision", "data analysis", "pandas", "numpy", "tensorflow",
    "pytorch", "html", "css", "bootstrap", "tailwind", "c++", "c#", ".net", "php", "ruby",
    "go", "rust", "swift", "kotlin", "android", "ios", "flutter", "react native", "rest api",
    "graphql", "microservices", "ci/cd", "linux", "bash", "shell scripting", "jira", "confluence",
    "figma", "photoshop", "illustrator", "ui/ux", "product management", "team handling", "leadership",
    "communication", "problem solving", "critical thinking", "time management"
]

def extract_skills_from_text(text: str) -> list:
    text_lower = text.lower()
    found_skills = []
    for skill in COMMON_SKILLS:
        if skill in text_lower:
            found_skills.append(skill)
    return found_skills

def compare_skills(resume_skills: list, jd_skills: list) -> dict:
    resume_set = set(skill.lower() for skill in resume_skills)
    jd_set = set(skill.lower() for skill in jd_skills)
    
    matched = list(resume_set & jd_set)
    missing = list(jd_set - resume_set)
    extra = list(resume_set - jd_set)
    
    match_percentage = (len(matched) / len(jd_set) * 100) if jd_set else 0.0
    
    return {
        "matched_skills": matched,
        "missing_skills": missing,
        "extra_skills": extra,
        "match_percentage": round(match_percentage, 2),
    }

def generate_gap_report(missing_skills: list) -> str:
    if not missing_skills:
        return "No significant skill gaps detected. Candidate is well-aligned with the job description."
    
    report_lines = [
        "Skill Gap Analysis:",
        "The following skills mentioned in the job description are missing or insufficient in the resume:",
        ""
    ]
    for skill in missing_skills:
        report_lines.append(f"- {skill.title()}")
    
    report_lines.extend([
        "",
        "Recommendations:",
        "Consider upskilling in the above areas to improve candidacy for this role."
    ])
    return "\n".join(report_lines)
