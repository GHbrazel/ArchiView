## Workflow Instructions

- Work Test driven: Write tests before implementing new features or fixing bugs. This ensures that your code is testable and helps catch issues early.

## Coding Style Instructions

- Separation of concerns: Each function should have a single responsibility. If a function is doing too much, consider breaking it into smaller functions.
- Naming conventions: Use descriptive names for variables, functions, and classes. Follow the camelCase convention for variables and functions, and PascalCase for classes.
- Consistent formatting: Use consistent indentation.
- Error handling: Use try-catch blocks to handle potential errors gracefully, and provide meaningful error messages.
- Comments: Use comments to explain the purpose of complex code blocks, but avoid over-commenting. The code should be self-explanatory where possible.
- Avoid magic numbers: Use constants or enums to represent fixed values instead of hardcoding them in the code.
- Use async/await for asynchronous operations to improve readability and maintainability.
- Follow the DRY (Don't Repeat Yourself) principle to avoid code duplication. If you find yourself writing the same code more than once, consider creating a reusable function or component.
- Write unit tests for functions to ensure they work as expected and to facilitate future refactoring.
- Avoid deep nesting of code blocks. If you find yourself with multiple levels of nesting, consider refactoring the code to reduce complexity.
- Avoid class names that end with "Manager" or "Helper". Instead, choose names that clearly indicate the purpose of the class.
- Avoid complex conditional statements. If you have a complex if-else or switch statement, consider refactoring it into smaller functions or using a strategy pattern to improve readability.
- If a function has more than 3 parameters, consider refactoring it to take an object as a parameter to improve readability and maintainability.
- If a function is longer than 20 lines, consider refactoring it into smaller functions to improve readability and maintainability.
- If a class has more than 5 methods, consider refactoring it into smaller classes to improve readability and maintainability.
- if a file has more than 300 lines of code, consider refactoring it into smaller files to improve readability and maintainability.
- If for loops are nested more than 2 levels deep, consider refactoring the code to reduce complexity and improve readability.
- Implement classes that represent entities in the codebase, such as Attribute, Class, Method, etc., to improve code organization and readability.
- Use interfaces to define the structure of objects and to enforce type safety in TypeScript.
- Use enums to represent a fixed set of related constants, such as attribute types or access modifiers, to improve code readability and maintainability.
- Use dependency injection to manage dependencies between classes and to improve testability and maintainability of the code.
- Use design patterns such as the Factory pattern, Singleton pattern, or Observer pattern where appropriate to improve code organization and maintainability.
- Use a consistent file structure for organizing code, such as grouping related classes and functions into modules or folders based on their functionality or domain.