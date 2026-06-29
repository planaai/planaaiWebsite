import sys
from bs4 import BeautifulSoup

file_path = "c:/Users/also1/Documents/ba_archive/ba_archive/data/블루 아카이브_경험치 테이블 - 나무위키.html"
with open(file_path, "r", encoding="utf-8") as f:
    soup = BeautifulSoup(f, "html.parser")

headings = soup.find_all(['h1', 'h2', 'h3', 'h4', 'h5'])
for h in headings:
    print(h.text.strip())
