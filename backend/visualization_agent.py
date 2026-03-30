"""
Visualization Agent
Creates a visualization design plan for plotting requests.
"""
import logging
from typing import List, Dict

from llm.groq_client import think_complete

logger = logging.getLogger("visualization_agent")


def design_visualization(
    query: str,
    datasets: List[dict],
    conversation_context: str = "",
    detailed_schemas: str = "",
) -> str:
    """Generate a visualization design plan for the query."""
    dataset_overview = ""
    for ds in datasets:
        dataset_overview += f"\n• '{ds['name']}' ({ds['row_count']} rows, {ds['col_count']} cols)"

    context_section = ""
    if conversation_context:
        context_section = f"""
CONVERSATION HISTORY:
{conversation_context}

Important: Resolve references like "it" or "that" using context.
"""

    schema_section = ""
    if detailed_schemas:
        schema_section = f"\nDETAILED SCHEMAS:{detailed_schemas}\n"

    prompt = f"""Design the best visualization for this request.
{context_section}
QUESTION: {query}

AVAILABLE DATASETS:{dataset_overview}
{schema_section}

VISUALIZATION DESIGN (be specific):
   - What chart type is BEST for this data? Why?
   - What goes on X-axis? (keep it readable - max 5-10 items)
   - What goes on Y-axis?
   - For multi-series: what are the series/legend items?
   - How to structure the data for the chart?
   
   Example for "top 5 users by count with channel breakdown":
   - Chart type: Grouped bar chart
   - X-axis: User names (5 users)
   - Y-axis: Video count
   - Series/Legend: Each channel as a separate bar group
   - Data structure: [{{'User': 'X', 'Channel A': 10, 'Channel B': 5}}, ...]

Return a concise, numbered visualization plan:"""

    logger.info("Generating visualization design...")
    response = think_complete([{"role": "user", "content": prompt}], temperature=0.3, max_tokens=800)
    return response.strip()
