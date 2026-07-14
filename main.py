from fastapi import FastAPI, UploadFile, File, Form, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
import os
import shutil
from datetime import datetime

from resume_parser import parse_resume
from analyzer import analyze_match, calculate_llm_match_score
from skill_gap import extract_skills_from_text, compare_skills, generate_gap_report
from report_gen import generate_pdf_report

app = FastAPI(title="Smart Resume Screener API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

@app.get("/api/health")
def health_check():
    return {"status": "ok", "message": "Smart Resume Screener API is running"}

@app.post("/api/upload-single")
async def upload_single_resume(file: UploadFile = File(...), job_description: str = Form(...)):
    file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().timestamp()}_{file.filename}")
    with open(file_path, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
    
    try:
        resume_text = parse_resume(file_path)
    except Exception as e:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail=f"Failed to parse resume: {str(e)}")
    
    if not resume_text:
        os.remove(file_path)
        raise HTTPException(status_code=400, detail="Could not extract text from file. Ensure it is a valid PDF, DOCX, or Image.")
    
    match_results = analyze_match(resume_text, job_description)
    
    llm_result = calculate_llm_match_score(resume_text, job_description)
    llm_score = llm_result.get("score") if isinstance(llm_result, dict) else None
    llm_justification = llm_result.get("justification", "") if isinstance(llm_result, dict) else ""
    
    resume_skills = extract_skills_from_text(resume_text)
    jd_skills = extract_skills_from_text(job_description)
    skill_comparison = compare_skills(resume_skills, jd_skills)
    skill_gap_text = generate_gap_report(skill_comparison["missing_skills"])
    
    skill_match = skill_comparison["match_percentage"]
    semantic_sim = match_results.get("semantic_similarity", 0.0)
    
    if llm_score is not None:
        overall_match = round(llm_score * 10, 2)
        potential_match = round(max(llm_score * 10, semantic_sim), 2)
    else:
        overall_match = round(skill_match, 2)
        potential_match = round(max(skill_match, semantic_sim), 2)
    
    match_results["overall_match"] = overall_match
    match_results["skill_match_percentage"] = round(skill_match, 2)
    match_results["potential_match"] = potential_match
    match_results["llm_score"] = llm_score
    match_results["llm_justification"] = llm_justification
    
    report_filename = generate_pdf_report(
        candidate_name=file.filename,
        match_score=match_results["overall_match"],
        jd_keywords=match_results["jd_keywords"],
        matched_keywords=match_results["matched_keywords"],
        missing_keywords=match_results["missing_keywords"],
        skill_gap_analysis=skill_gap_text,
    )
    
    os.remove(file_path)
    
    return {
        "candidate_name": file.filename,
        "match_score": match_results["overall_match"],
        "skill_match_percentage": match_results["skill_match_percentage"],
        "potential_match": match_results["potential_match"],
        "jd_keywords": match_results["jd_keywords"],
        "resume_keywords": match_results["resume_keywords"],
        "matched_keywords": match_results["matched_keywords"],
        "missing_keywords": match_results["missing_keywords"],
        "sentence_scores": match_results["sentence_scores"],
        "skill_comparison": skill_comparison,
        "skill_gap_analysis": skill_gap_text,
        "report_filename": report_filename,
        "llm_score": match_results.get("llm_score"),
        "llm_justification": match_results.get("llm_justification", ""),
    }

@app.post("/api/upload-bulk")
async def upload_bulk_resumes(files: list[UploadFile] = File(...), job_description: str = Form(...)):
    results = []
    for file in files:
        if not file.filename:
            continue
        file_path = os.path.join(UPLOAD_DIR, f"{datetime.now().timestamp()}_{file.filename}")
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        try:
            resume_text = parse_resume(file_path)
            if not resume_text:
                results.append({"filename": file.filename, "error": "Could not extract text", "match_score": 0.0})
                os.remove(file_path)
                continue
            
            match_results = analyze_match(resume_text, job_description)
            llm_result = calculate_llm_match_score(resume_text, job_description)
            llm_score = llm_result.get("score") if isinstance(llm_result, dict) else None
            llm_justification = llm_result.get("justification", "") if isinstance(llm_result, dict) else ""
            resume_skills = extract_skills_from_text(resume_text)
            jd_skills = extract_skills_from_text(job_description)
            skill_comparison = compare_skills(resume_skills, jd_skills)
            skill_match = skill_comparison["match_percentage"]
            semantic_sim = match_results.get("semantic_similarity", 0.0)
            
            if llm_score is not None:
                match_score = round(llm_score * 10, 2)
                potential_match = round(max(llm_score * 10, semantic_sim), 2)
            else:
                match_score = round(skill_match, 2)
                potential_match = round(max(skill_match, semantic_sim), 2)
            
            results.append({
                "filename": file.filename,
                "match_score": match_score,
                "potential_match": potential_match,
                "matched_keywords": match_results["matched_keywords"],
                "missing_keywords": match_results["missing_keywords"],
                "skill_comparison": skill_comparison,
                "llm_score": llm_score,
                "llm_justification": llm_justification,
            })
            os.remove(file_path)
        except Exception as e:
            results.append({"filename": file.filename, "error": str(e), "match_score": 0.0})
            if os.path.exists(file_path):
                os.remove(file_path)
    
    results.sort(key=lambda x: x.get("match_score", 0), reverse=True)
    for idx, item in enumerate(results, 1):
        item["rank"] = idx
    
    return {"total": len(results), "results": results}

@app.get("/api/download-report/{filename}")
async def download_report(filename: str):
    file_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "reports", filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Report not found")
    return FileResponse(file_path, media_type="application/pdf", filename=filename)

frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "frontend")
if os.path.exists(frontend_dir):
    app.mount("/", StaticFiles(directory=frontend_dir, html=True), name="frontend")
