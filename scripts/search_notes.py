import os
import sys

def search_vault(keyword, vault_dir="./docs-vault"):
    keyword = keyword.lower()
    matches = []
    
    for root, _, files in os.walk(vault_dir):
        # .obsidian 등 숨김 폴더 건너뛰기
        if "/." in root or "\\." in root:
            continue
            
        for file in files:
            if file.endswith(".md"):
                file_path = os.path.join(root, file)
                rel_path = os.path.relpath(file_path, vault_dir)
                try:
                    with open(file_path, "r", encoding="utf-8") as f:
                        for line_num, line in enumerate(f, 1):
                            if keyword in line.lower():
                                matches.append(f"[{rel_path}:{line_num}] {line.strip()}")
                except Exception:
                    continue

    if not matches:
        return f"'{keyword}'에 대한 검색 결과가 없습니다."
    
    # 토큰 폭주를 막기 위해 상위 15개 결과만 반환
    return "\n".join(matches[:15])

if __name__ == "__main__":
    if len(sys.argv) > 1:
        query = " ".join(sys.argv[1:])
        print(search_vault(query))
    else:
        print("검색어를 입력하세요. 예: python scripts/search_notes.py 인증")