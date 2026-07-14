import re
import nltk
from nltk.corpus import stopwords
from nltk.tokenize import sent_tokenize, word_tokenize
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

try:
    nltk.data.find("tokenizers/punkt")
    nltk.data.find("corpora/stopwords")
except LookupError:
    nltk.download("punkt")
    nltk.download("stopwords")

STOP_WORDS = set(stopwords.words("english"))

def preprocess_text(text: str) -> str:
    text = text.lower()
    text = re.sub(r"[^a-zA-Z0-9\s]", " ", text)
    tokens = word_tokenize(text)
    tokens = [word for word in tokens if word not in STOP_WORDS]
    return " ".join(tokens)

def extract_keywords_tfidf(text: str, top_n: int = 20) -> list:
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2), max_features=1000)
    tfidf_matrix = vectorizer.fit_transform([text])
    feature_names = vectorizer.get_feature_names_out()
    scores = tfidf_matrix.toarray()[0]
    keywords_with_scores = sorted(zip(feature_names, scores), key=lambda x: x[1], reverse=True)
    return [kw[0] for kw in keywords_with_scores[:top_n]]

def calculate_semantic_similarity(text1: str, text2: str) -> float:
    processed1 = preprocess_text(text1)
    processed2 = preprocess_text(text2)
    if not processed1 or not processed2:
        return 0.0
    vectorizer = TfidfVectorizer(stop_words="english", ngram_range=(1, 2))
    tfidf_matrix = vectorizer.fit_transform([processed1, processed2])
    similarity = cosine_similarity(tfidf_matrix[0:1], tfidf_matrix[1:2])
    return float(similarity[0][0]) * 100

def analyze_match(resume_text: str, jd_text: str) -> dict:
    similarity = calculate_semantic_similarity(resume_text, jd_text)
    
    jd_keywords = extract_keywords_tfidf(jd_text)
    resume_keywords = extract_keywords_tfidf(resume_text)
    
    matched_keywords = list(set(jd_keywords) & set(resume_keywords))
    missing_keywords = list(set(jd_keywords) - set(resume_keywords))
    
    jd_sentences = sent_tokenize(jd_text)
    sentence_scores = []
    for sentence in jd_sentences:
        score = calculate_semantic_similarity(sentence, resume_text)
        sentence_scores.append({"sentence": sentence, "score": score})
    
    overall_match = min(95.0, round(similarity, 2))
    
    return {
        "overall_match": overall_match,
        "semantic_similarity": round(similarity, 2),
        "jd_keywords": jd_keywords,
        "resume_keywords": resume_keywords,
        "matched_keywords": matched_keywords,
        "missing_keywords": missing_keywords,
        "sentence_scores": sentence_scores,
    }

def calculate_llm_match_score(resume_text: str, jd_text: str) -> dict:
    import os
    from openai import OpenAI
    
    api_key = os.getenv("OPENAI_API_KEY")
    if not api_key:
        return {"score": None, "justification": ""}
    
    client = OpenAI(api_key=api_key)
    
    prompt = f"""You are an expert technical recruiter. Compare the following resume with this job description and rate fit on 1-10 with justification.

Resume:
{resume_text[:4000]}

Job Description:
{jd_text[:4000]}

Provide your response in this exact format:
Score: <number 1-10>
Justification: <brief explanation of why this score was given>"""

    try:
        response = client.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {"role": "system", "content": "You are a precise hiring assistant. Always respond in the format: Score: X, Justification: Y"},
                {"role": "user", "content": prompt}
            ],
            max_tokens=150,
            temperature=0.2
        )
        
        content = response.choices[0].message.content.strip()
        score = None
        justification = ""
        
        import re
        score_match = re.search(r"Score:\s*(\d+)", content)
        if score_match:
            score = float(score_match.group(1))
            score = max(1.0, min(10.0, score))
        
        justification_match = re.search(r"Justification:\s*(.+)", content, re.DOTALL)
        if justification_match:
            justification = justification_match.group(1).strip()
        
        return {"score": score, "justification": justification}
    except Exception:
        return {"score": None, "justification": ""}
