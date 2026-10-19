#!/usr/bin/env python3
from backend.recipe_import import extract_nutrition_json_ld, BeautifulSoup

html = '''<html><head><script type="application/ld+json">{"@context":"https://schema.org/","@type":"Recipe","nutrition":{"@type":"NutritionInformation","calories":"500 calories","proteinContent":"30 grams of protein"}}</script></head></body></html>'''
result = extract_nutrition_json_ld(BeautifulSoup(html))
print('Extracted:', result)
