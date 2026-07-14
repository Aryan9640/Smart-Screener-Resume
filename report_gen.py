from reportlab.lib.pagesizes import A4
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, PageBreak
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm
from reportlab.lib import colors
from reportlab.graphics.shapes import Drawing
from reportlab.graphics.charts.piecharts import Pie
from datetime import datetime
import os

REPORTS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "reports")

def generate_pdf_report(candidate_name: str, match_score: float, jd_keywords: list, matched_keywords: list, missing_keywords: list, skill_gap_analysis: str) -> str:
    os.makedirs(REPORTS_DIR, exist_ok=True)
    filename = f"report_{candidate_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.pdf"
    file_path = os.path.join(REPORTS_DIR, filename)
    
    doc = SimpleDocTemplate(file_path, pagesize=A4)
    styles = getSampleStyleSheet()
    
    custom_title_style = ParagraphStyle(
        "CustomTitle", parent=styles["Heading1"], fontSize=24, spaceAfter=20,
        textColor=colors.HexColor("#2c3e50"), alignment=1
    )
    custom_heading_style = ParagraphStyle(
        "CustomHeading", parent=styles["Heading2"], fontSize=16, spaceAfter=10,
        textColor=colors.HexColor("#2980b9"), spaceBefore=15
    )
    custom_body_style = ParagraphStyle(
        "CustomBody", parent=styles["BodyText"], fontSize=11, spaceAfter=8, leading=14
    )
    
    story = []
    story.append(Paragraph("Smart Resume Screener Report", custom_title_style))
    story.append(Paragraph(f"Generated on: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}", ParagraphStyle("Date", parent=styles["Normal"], alignment=1, spaceAfter=20)))
    story.append(Spacer(1, 0.5*cm))
    
    story.append(Paragraph(f"Candidate: {candidate_name}", custom_heading_style))
    story.append(Paragraph(f"Overall Match Score: <b>{match_score}%</b>", custom_body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("Match Score Visualization", custom_heading_style))
    drawing = Drawing(200, 100)
    pie = Pie()
    pie.x = 50
    pie.y = 20
    pie.width = 100
    pie.height = 100
    pie.data = [match_score, max(0, 100 - match_score)]
    pie.labels = ["Matched", "Gap"]
    pie.slices.strokeWidth = 0
    pie.slices[0].fillColor = colors.HexColor("#27ae60")
    pie.slices[1].fillColor = colors.HexColor("#e74c3c")
    drawing.add(pie)
    story.append(drawing)
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("JD Keywords Detected", custom_heading_style))
    for kw in jd_keywords:
        story.append(Paragraph(f"• {kw}", custom_body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("Matched Keywords", custom_heading_style))
    if matched_keywords:
        for kw in matched_keywords:
            story.append(Paragraph(f"• {kw}", ParagraphStyle("GreenBody", parent=custom_body_style, textColor=colors.HexColor("#27ae60"))))
    else:
        story.append(Paragraph("No keywords matched.", custom_body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("Missing Keywords", custom_heading_style))
    if missing_keywords:
        for kw in missing_keywords:
            story.append(Paragraph(f"• {kw}", ParagraphStyle("RedBody", parent=custom_body_style, textColor=colors.HexColor("#e74c3c"))))
    else:
        story.append(Paragraph("No missing keywords. Excellent match!", custom_body_style))
    story.append(Spacer(1, 0.3*cm))
    
    story.append(Paragraph("Skill Gap Analysis", custom_heading_style))
    story.append(Paragraph(skill_gap_analysis.replace("\n", "<br/>"), custom_body_style))
    
    doc.build(story)
    return filename
