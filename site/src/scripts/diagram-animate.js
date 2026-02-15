document.addEventListener("DOMContentLoaded", () => {
  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  if (prefersReducedMotion) {
    return;
  }

  // Architecture diagram animation (LocalFirst section)
  const diagram = document.querySelector(".diagram");
  if (diagram) {
    const nodes = diagram.querySelectorAll(".diagram-node");
    const connectors = diagram.querySelectorAll(".diagram-connector");

    // Set initial states
    nodes.forEach((node) => {
      node.style.opacity = "0";
      node.style.transform = "translateY(12px)";
    });

    connectors.forEach((connector) => {
      const line = connector.querySelector(".diagram-line");
      if (line) {
        line.style.transformOrigin = "top";
        line.style.transform = "scaleY(0)";
      }
    });

    let diagramAnimated = false;

    const diagramObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !diagramAnimated) {
            diagramAnimated = true;
            diagramObserver.unobserve(entry.target);
            animateDiagram(nodes, connectors);
          }
        });
      },
      { threshold: 0.3 },
    );

    diagramObserver.observe(diagram);
  }

  function animateDiagram(nodes, connectors) {
    const allItems = [];
    for (let i = 0; i < nodes.length; i++) {
      allItems.push({ type: "node", el: nodes[i] });
      if (i < connectors.length) {
        allItems.push({ type: "connector", el: connectors[i] });
      }
    }

    let delay = 200;
    for (const item of allItems) {
      if (item.type === "node") {
        setTimeout(() => {
          item.el.style.transition =
            "opacity 400ms cubic-bezier(0.16, 1, 0.3, 1), transform 400ms cubic-bezier(0.16, 1, 0.3, 1)";
          item.el.style.opacity = "1";
          item.el.style.transform = "translateY(0)";
        }, delay);
        delay += 150;
      } else {
        const line = item.el.querySelector(".diagram-line");
        if (line) {
          setTimeout(() => {
            line.style.transition = "transform 300ms cubic-bezier(0.16, 1, 0.3, 1)";
            line.style.transform = "scaleY(1)";
          }, delay);
        }
        delay += 100;
      }
    }
  }

  // Oplog timeline animation (SyncArchitecture section)
  const timeline = document.querySelector(".oplog-timeline");
  if (timeline) {
    const timelineLine = timeline.querySelector(".timeline-line");
    const events = timeline.querySelectorAll(".timeline-event");

    // Set initial states
    if (timelineLine) {
      timelineLine.style.transformOrigin = "left";
      timelineLine.style.transform = "scaleX(0)";
    }

    events.forEach((event) => {
      event.style.opacity = "0";
      event.style.transform = "scale(0.5)";
    });

    let timelineAnimated = false;

    const timelineObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !timelineAnimated) {
            timelineAnimated = true;
            timelineObserver.unobserve(entry.target);
            animateTimeline(timelineLine, events);
          }
        });
      },
      { threshold: 0.2 },
    );

    timelineObserver.observe(timeline);
  }

  function animateTimeline(line, events) {
    // First draw the line
    setTimeout(() => {
      if (line) {
        line.style.transition = "transform 800ms cubic-bezier(0.16, 1, 0.3, 1)";
        line.style.transform = "scaleX(1)";
      }
    }, 200);

    // Then reveal dots one by one from left to right
    events.forEach((event, index) => {
      setTimeout(
        () => {
          event.style.transition =
            "opacity 300ms cubic-bezier(0.16, 1, 0.3, 1), transform 300ms cubic-bezier(0.16, 1, 0.3, 1)";
          event.style.opacity = "1";
          event.style.transform = "scale(1)";

          const dot = event.querySelector(".timeline-dot");
          if (dot) {
            dot.classList.add("dot-animate-in");
          }
        },
        400 + index * 120,
      );
    });
  }
});
