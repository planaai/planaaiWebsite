import sys

class MockEntry:
    def __init__(self, text):
        self._text = text
    def text(self):
        return self._text

class MockWindow:
    def __init__(self):
        self.entries = {
            "studentName": MockEntry("유우카"),
            "bondRank": MockEntry("20"),
            "currentLevel": MockEntry("90"),
            "currentStar": MockEntry("5"),
            "skills.ex": MockEntry("3"),
            "skills.basic": MockEntry("5"),
            "skills.enh": MockEntry("3"),
            "skills.sub": MockEntry("3"),
            "weapon.level": MockEntry("30"),
            "weapon.star": MockEntry("2"),
            "equipment.slot1.tier": MockEntry("8"),
            "equipment.slot1.level": MockEntry("60"),
            "equipment.slot2.tier": MockEntry("8"),
            "equipment.slot2.level": MockEntry("60"),
            "equipment.slot3.tier": MockEntry("8"),
            "equipment.slot3.level": MockEntry("60"),
            "equipment.slot4.tier": MockEntry("1"),
            "stats.maxHP": MockEntry("13955"),
            "stats.hpAbility": MockEntry("17"),
            "stats.attackPower": MockEntry("2290"),
            "stats.atkAbility": MockEntry(""),
            "stats.defensePower": MockEntry("664"),
            "stats.healPower": MockEntry("6335"),
            "stats.healAbility": MockEntry("")
        }
        self.batch_results = [{"data": {}}]
        self.current_idx = 0
        self.single_result = self.batch_results[0]
        
    def safe_int(self, key):
        val = self.entries[key].text().strip()
        if not val: return None
        try: return int(val)
        except: return val

    def save_current_index(self):
        res = self.batch_results[self.current_idx]
        
        edited_data = {
            "studentName": self.entries["studentName"].text().strip(),
            "bondRank": self.safe_int("bondRank"),
            "currentLevel": self.safe_int("currentLevel"),
            "currentStar": self.safe_int("currentStar"),
            "skills": {
                "ex": self.entries["skills.ex"].text().strip(),
                "basic": self.entries["skills.basic"].text().strip(),
                "enh": self.entries["skills.enh"].text().strip(),
                "sub": self.entries["skills.sub"].text().strip()
            },
            "weapon": {
                "level": self.safe_int("weapon.level"),
                "star": self.safe_int("weapon.star")
            },
            "equipment": {
                "slot1": { "tier": self.safe_int("equipment.slot1.tier"), "level": self.safe_int("equipment.slot1.level") },
                "slot2": { "tier": self.safe_int("equipment.slot2.tier"), "level": self.safe_int("equipment.slot2.level") },
                "slot3": { "tier": self.safe_int("equipment.slot3.tier"), "level": self.safe_int("equipment.slot3.level") },
                "slot4": { "tier": self.safe_int("equipment.slot4.tier") }
            },
            "stats": {
                "maxHP": self.safe_int("stats.maxHP"),
                "hpAbility": self.safe_int("stats.hpAbility"),
                "attackPower": self.safe_int("stats.attackPower"),
                "atkAbility": self.safe_int("stats.atkAbility"),
                "defensePower": self.safe_int("stats.defensePower"),
                "healPower": self.safe_int("stats.healPower"),
                "healAbility": self.safe_int("stats.healAbility")
            }
        }
        res["data"] = edited_data
        
    def on_upload(self):
        self.save_current_index()
        res = self.single_result
        data = res["data"]
        
        payload = {
            "studentName": data.get("studentName"),
            "currentLevel": data.get("currentLevel"),
            "currentStar": data.get("currentStar"),
            "skills": data.get("skills", {}),
            "equipment": data.get("equipment", {}),
            "weapon": data.get("weapon", {}),
            "stats": data.get("stats", {})
        }
        import json
        print(json.dumps(payload, indent=2))

MockWindow().on_upload()
