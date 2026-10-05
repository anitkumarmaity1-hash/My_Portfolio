# Anit Kumar Maity — Portfolio

Personal portfolio site, served with FastAPI.

## Run locally

```bash
python -m venv venv
source venv/bin/activate   # venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload
```

Open http://127.0.0.1:8000

## Project structure

```
main.py                 FastAPI app — serves the page and /api/contact
templates/index.html    The single-page site
static/css/style.css    Design system + layout
static/js/script.js     Nav, mobile menu, scroll reveal, contact form
static/img/             Profile photos
static/docs/            Resumes, certificates, semester results, case studies
```

## Contact form

Submissions to `/api/contact` are validated and appended to
`data/contact_messages.jsonl` (created on first submission, gitignored).
There's no email delivery wired up yet — check that file, or wire it to
your own store, to see messages that come in.
