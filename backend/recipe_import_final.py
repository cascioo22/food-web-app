def process_import(url: str, manual_data: Optional[Dict[str, Any]] = None) -> RecipeImportResult:
    """
    Process a recipe import request.
    
    Args:
        url: Recipe URL to import (optional if manual entry)
        manual_data: Pre-filled manual entry data
    
    Returns:
        RecipeImportResult with extracted recipe or error info
    """
    # If manual entry provided, return it directly
    if manual_data and url:
        validated = validate_extracted_recipe(manual_data)
        
        return RecipeImportResult(
            success=len(validated) == 0,
            error_message='; '.join(validated) if validated else None,
            extracted_recipe=manual_data,
            is_manual_entry=True,
            original_url=None  # Manual entry has no URL
        )
    
    # Validate URL safety first
    is_valid, error_msg = is_safe_url(url)
    if not is_valid:
        return RecipeImportResult(
            success=False,
            error_message=error_msg,
            extracted_recipe=None,
            original_url=url
        )
    
    # Fetch the URL
    html_content = fetch_url_safely(url)
    if html_content is None:
        return RecipeImportResult(
            success=False,
            error_message="Failed to fetch recipe URL",
            extracted_recipe=None,
            original_url=url
        )
    
    # Parse HTML for nutrition extraction
    soup = None
    try:
        from bs4 import BeautifulSoup
        soup = BeautifulSoup(html_content, 'html.parser')
    except ImportError:
        pass
    
    # Extract structured data
    extracted = extract_recipe_structured_data(html_content, url)
    
    if not extracted:
        return RecipeImportResult(
            success=False,
            error_message="No recipe data could be extracted from page",
            extracted_recipe=None,
            original_url=url
        )
    
    # Try to extract nutrition information
    nutrition_extracted = None
    if soup:
        nutrition_extracted = extract_nutrition_json_ld(soup)
    
    # Validate the extraction
    issues = validate_extracted_recipe(extracted)
    
    if issues:
        return RecipeImportResult(
            success=True,  # We got something, but with warnings
            error_message='; '.join(issues),
            extracted_recipe=extracted,
            original_url=url
        )
    
    return RecipeImportResult(
        success=True,
        extracted_recipe=extracted,
        nutrition_extracted=nutrition_extracted,  # Pass nutrition data back to caller
        original_url=url
    )
