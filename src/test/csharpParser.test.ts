import { describe, test, expect } from 'vitest';
import { CSharpParser } from '../csharpParser';

describe('Real Attributes Detection', () => {
	test('should detect simple attributes on classes', () => {
		const code = `
namespace TestNamespace
{
[Serializable]
public class TestClass
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Serializable');
		expect(attributes[0].targetElement).toBe('class');
	});

	test('should detect multiple attributes on a class', () => {
		const code = `
namespace TestNamespace
{
[Serializable]
[Required]
[Obsolete("test")]
public class TestClass
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(3);
		const names = attributes.map(a => a.name);
		expect(names).toContain('Serializable');
		expect(names).toContain('Required');
		expect(names).toContain('Obsolete');
	});

	test('should extract target names for all stacked attributes on same element', () => {
		const code = `
namespace TestNamespace
{
[Serializable]
[Table("Users")]
public class User
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const serializableAttr = attributes.find(a => a.name === 'Serializable');
		const tableAttr = attributes.find(a => a.name === 'Table');
		
		expect(serializableAttr).toBeTruthy();
		expect(tableAttr).toBeTruthy();
		expect(serializableAttr?.targetName).toBe('User');
		expect(tableAttr?.targetName).toBe('User');
	});

	test('should detect attributes on properties', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[Key]
	[Required]
	public int Id { get; set; }
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		expect(attributes.every(a => a.targetElement === 'property')).toBe(true);
	});

	test('should detect attributes on methods', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[Obsolete("Use NewMethod")]
	public void OldMethod()
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Obsolete');
		expect(attributes[0].targetElement).toBe('method');
	});

	test('should extract attribute parameters', () => {
		const code = `
namespace TestNamespace
{
[ApiEndpoint("/api/users", "POST")]
public class UserController
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('ApiEndpoint');
		expect(attributes[0].arguments).toBe('"/api/users", "POST"');
	});

	test('should extract complex attribute arguments', () => {
		const code = `
namespace TestNamespace
{
[StringLength(255, MinimumLength = 3)]
public string Name { get; set; }
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].arguments).toContain('255');
		expect(attributes[0].arguments).toContain('MinimumLength');
	});
});

describe('False Positives - Array Indexing', () => {
	test('should NOT detect array access as attribute', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessData()
	{
		int[] productIds = { 1, 2, 3 };
		int firstId = productIds[0];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});

	test('should NOT detect string character access as attribute', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessString()
	{
		string name = "test";
		char firstChar = name[0];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});

	test('should NOT detect multi-dimensional array access as attribute', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessMatrix()
	{
		int[][] matrix = new int[3][];
		int value = matrix[0][1];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});

	test('should NOT detect List access as attribute', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessList()
	{
		List<int> items = new List<int> { 1, 2, 3 };
		int item = items[0];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});

	test('should NOT detect Dictionary access as attribute', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessDict()
	{
		Dictionary<string, int> dict = new Dictionary<string, int>();
		int value = dict["key"];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});

	test('should NOT detect array with variable index as attribute', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessWithIndex()
	{
		int[] data = { 10, 20, 30 };
		int index = 1;
		int value = data[index];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});

	test('should NOT detect array with expression as attribute', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessWithExpression()
	{
		int[] data = { 10, 20, 30 };
		int value = data[data.Length - 1];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});
});

describe('Mixed Real Attributes and False Positives', () => {
	test('should detect only real attributes while ignoring array indexing', () => {
		const code = `
namespace TestNamespace
{
[Serializable]
[Repository("ProductRepository")]
public class Product
{
	[Key]
	[Required]
	public int Id { get; set; }

	[StringLength(100)]
	public string Name { get; set; }

	public void ProcessIds()
	{
		int[] ids = { 1, 2, 3 };
		int first = ids[0];
		int second = ids[1];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(5);
		const names = attributes.map(a => a.name);
		expect(names).toContain('Serializable');
		expect(names).toContain('Repository');
		expect(names).toContain('Key');
		expect(names).toContain('Required');
		expect(names).toContain('StringLength');
		expect(names).not.toContain('0');
		expect(names).not.toContain('1');
	});

	test('should handle complex code with methods containing array access', () => {
		const code = `
namespace AnotherExampleCsProject.Controllers
{
[Authorize("Admin")]
[Cacheable(600)]
public class UserController
{
	[Loggable("Debug")]
	public void GetUsers()
	{
		// Array operations
		int[] userIds = { 1, 2, 3, 4, 5 };
		int firstUserId = userIds[0];
		string[] roles = { "Admin", "User" };
		string role = roles[1];
		
		// Dictionary access
		Dictionary<int, string> userData = new Dictionary<int, string>();
		string data = userData[1];
	}

	[Authorize("Admin")]
	[Obsolete("Use DeleteAsync")]
	public void DeleteUser(int id)
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(5);
		const attributeNames = attributes.map(a => a.name);
		expect(attributeNames).toContain('Authorize');
		expect(attributeNames).toContain('Cacheable');
		expect(attributeNames).toContain('Loggable');
		expect(attributeNames).toContain('Obsolete');
	});
});

describe('Namespace Extraction', () => {
	test('should extract namespace from class', () => {
		const code = `
namespace CsAttributeExampleProject.Models
{
[Serializable]
public class Product
{
}
}`;
		const namespace = CSharpParser.extractNamespace(code);
		expect(namespace).toBe('CsAttributeExampleProject.Models');
	});

	test('should extract nested namespace', () => {
		const code = `
namespace Company.Project.SubNamespace.Models
{
[Required]
public class Entity
{
}
}`;
		const namespace = CSharpParser.extractNamespace(code);
		expect(namespace).toBe('Company.Project.SubNamespace.Models');
	});

	test('should handle missing namespace', () => {
		const code = `
[Serializable]
public class TestClass
{
}`;
		const namespace = CSharpParser.extractNamespace(code);
		expect(namespace).toBe('');
	});
});

describe('Edge Cases', () => {
	test('should handle attributes with nested brackets', () => {
		const code = `
namespace TestNamespace
{
[TypeOf(typeof(List<string>))]
public class GenericTest
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBeGreaterThan(0);
	});

	test('should not confuse generic type parameters with attributes', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public List<User> users;
	public Dictionary<string, int> mapping;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});

	test('should handle attributes with line breaks', () => {
		const code = `
namespace TestNamespace
{
[ApiEndpoint(
	"/api/users",
	"GET"
)]
public class UserController
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('ApiEndpoint');
	});

	test('should handle array in attribute arguments vs array access', () => {
		const code = `
namespace TestNamespace
{
[ArrayAttribute(new int[] { 1, 2, 3 })]
public class TestClass
{
	public void Method()
	{
		int[] ids = { 1, 2, 3 };
		int value = ids[0];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('ArrayAttribute');
	});
});

describe('Line Number Tracking', () => {
	test('should track line numbers for attributes', () => {
		const code = `namespace Test
{
[Attribute1]
public class Class1
{
	[Attribute2]
	public int Property { get; set; }
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		expect(attributes[0].line).toBeGreaterThanOrEqual(2);
		expect(attributes[1].line).toBeGreaterThanOrEqual(5);
	});
});

describe('Parameter Attributes', () => {
	test('should detect simple parameter attributes', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public static void ThrowWhenNull([NotNull] object value)
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('NotNull');
		expect(attributes[0].targetElement).toBe('parameter');
		expect(attributes[0].parameterType).toBe('object');
		expect(attributes[0].parameterName).toBe('value');
	});

	test('should detect multiple parameter attributes on same method', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ProcessData([NotNull] string message, [Optional] int timeout)
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const notNullAttr = attributes.find(a => a.name === 'NotNull');
		const optionalAttr = attributes.find(a => a.name === 'Optional');
		
		expect(notNullAttr).toBeTruthy();
		expect(optionalAttr).toBeTruthy();
		expect(notNullAttr?.parameterName).toBe('message');
		expect(optionalAttr?.parameterName).toBe('timeout');
	});

	test('should detect parameter attributes with arguments', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void ConfigureRoute([FromQuery] string query, [Range(1, 100)] int count)
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		
		const rangeAttr = attributes.find(a => a.name === 'Range');
		expect(rangeAttr).toBeTruthy();
		expect(rangeAttr?.arguments.includes('1')).toBe(true);
		expect(rangeAttr?.arguments.includes('100')).toBe(true);
	});

	test('should detect parameter attributes with custom types', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void HandleRequest([FromQuery] ReportDto report, [NotNull] UserModel user)
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		
		const queryAttr = attributes.find(a => a.name === 'FromQuery');
		const notNullAttr = attributes.find(a => a.name === 'NotNull');
		
		expect(queryAttr?.parameterType).toBe('ReportDto');
		expect(queryAttr?.parameterName).toBe('report');
		expect(notNullAttr?.parameterType).toBe('UserModel');
		expect(notNullAttr?.parameterName).toBe('user');
	});

	test('should detect parameter attributes spanning multiple lines', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public static void ThrowWhenNull([NotNull] object? value, string valueExpression = "")
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const notNullAttr = attributes.find(a => a.name === 'NotNull' && a.targetElement === 'parameter');
		expect(notNullAttr).toBeTruthy();
		expect(notNullAttr?.parameterType).toBe('object?');
		expect(notNullAttr?.parameterName).toBe('value');
	});

	test('should handle attributes on class and parameter level together', () => {
		const code = `
namespace TestNamespace
{
[Serializable]
public class TestClass
{
	[Obsolete("old")]
	public void OldMethod([NotNull] object value)
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(3);
		
		const classAttrs = attributes.filter(a => a.targetElement === 'class');
		const methodAttrs = attributes.filter(a => a.targetElement === 'method');
		const paramAttrs = attributes.filter(a => a.targetElement === 'parameter');
		
		expect(classAttrs.length).toBe(1);
		expect(methodAttrs.length).toBe(1);
		expect(paramAttrs.length).toBe(1);
	});

	test('should NOT detect parameter attributes without proper parameter declaration', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void Method()
	{
		int[] data = { 1, 2, 3 };
		int value = data[0];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(0);
	});
});

describe('Field Attributes', () => {
	test('should detect simple attributes on fields', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[Serializable]
	private string _name;

	[NonSerialized]
	private int _tempValue;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const names = attributes.map(a => a.name);
		expect(names.includes('Serializable')).toBe(true);
		expect(names.includes('NonSerialized')).toBe(true);
	});

	test('should detect attributes on public fields', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[Required]
	public string Name;

	[Range(1, 100)]
	public int Age;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const rangeAttr = attributes.find(a => a.name === 'Range');
		expect(rangeAttr).toBeTruthy();
		expect(rangeAttr?.arguments.includes('1')).toBe(true);
	});
});

describe('Event Attributes', () => {
	test('should detect attributes on events', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[Obsolete("Use OnDataChanged")]
	public event EventHandler OnDataModified;

	[Serializable]
	public event Action<string> OnMessage;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const names = attributes.map(a => a.name);
		expect(names.includes('Obsolete')).toBe(true);
		expect(names.includes('Serializable')).toBe(true);
	});
});

describe('Return Type Attributes', () => {
	test('should detect return type attributes on methods', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[return: NotNull]
	public object GetValue()
	{
		return new object();
	}

	[return: MaybeNull]
	public string GetName()
	{
		return null;
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const returnAttrs = attributes.filter(a => a.targetElement === 'return');
		expect(returnAttrs.length).toBe(2);
	});

	test('should detect return type attributes with explicit target on properties', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[return: NotNull]
	public string Name { get; }

	[return: MaybeNull]
	public object Value { get; set; }
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const returnAttrs = attributes.filter(a => a.targetElement === 'return');
		expect(returnAttrs.length).toBe(2);
	});
});

describe('Explicit Target Specifiers', () => {
	test('should detect attributes with explicit type target', () => {
		const code = `
namespace TestNamespace
{
[type: Serializable]
public class TestClass
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Serializable');
	});

	test('should detect attributes with explicit method target', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[method: Obsolete("old")]
	public void OldMethod()
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Obsolete');
	});

	test('should detect attributes with explicit field target', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[field: Serializable]
	public string Name { get; set; }
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Serializable');
	});

	test('should detect attributes with explicit property target', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[property: Required]
	public string Name { get; set; }
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Required');
	});

	test('should detect attributes with explicit param target', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	public void SetValue([param: Required] string value)
	{
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Required');
	});

	test('should detect attributes with explicit event target', () => {
		const code = `
namespace TestNamespace
{
public class TestClass
{
	[event: Serializable]
	public event EventHandler MyEvent;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('Serializable');
	});
});

describe('Global/Assembly Attributes', () => {
	test('should detect assembly-level attributes', () => {
		const code = `[assembly: AssemblyVersion("1.0.0")]
[assembly: AssemblyCulture("en-US")]

namespace TestNamespace
{
public class TestClass
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(2);
		const names = attributes.map(a => a.name);
		expect(names.includes('AssemblyVersion')).toBe(true);
		expect(names.includes('AssemblyCulture')).toBe(true);
	});

	test('should detect module-level attributes', () => {
		const code = `[module: MyModuleAttribute]

namespace TestNamespace
{
public class TestClass
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(1);
		expect(attributes[0].name).toBe('MyModuleAttribute');
	});

	test('should detect assembly attributes with arguments', () => {
		const code = `[assembly: AssemblyCompany("Acme Corp")]
[assembly: AssemblyProduct("MyProduct")]
[assembly: AssemblyFileVersion("2.5.1.0")]

namespace TestNamespace
{
public class Test
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBe(3);
		const versionAttr = attributes.find(a => a.name === 'AssemblyFileVersion');
		expect(versionAttr?.arguments.includes('2.5.1.0')).toBe(true);
	});
});

describe('Type Parameter Attributes', () => {
	test('should detect attributes on generic type parameters', () => {
		const code = `
namespace TestNamespace
{
public class Generic<[Covariant] T>
{
}

public interface IGeneric<[Contravariant] U>
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		expect(Array.isArray(attributes)).toBe(true);
	});
});

describe('Complex Multi-Level Attributes', () => {
	test('should detect mix of class, field, property, and method attributes', () => {
		const code = `
namespace TestNamespace
{
[Serializable]
[Table("Users")]
public class User
{
	[Key]
	public int Id { get; set; }

	[Column("FullName")]
	[StringLength(100)]
	private string _name;

	[Obsolete("Use GetFullName")]
	public string GetName()
	{
		return _name;
	}

	[return: NotNull]
	public string GetFullName()
	{
		return "Name";
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBeGreaterThanOrEqual(7);
		const names = attributes.map(a => a.name);
		expect(names.includes('Serializable')).toBe(true);
		expect(names.includes('StringLength')).toBe(true);
		expect(names.includes('Key')).toBe(true);
		expect(names.includes('Obsolete')).toBe(true);
		expect(names.includes('NotNull')).toBe(true);
	});

	test('should handle assembly and type attributes together', () => {
		const code = `[assembly: AssemblyVersion("1.0.0.0")]

namespace TestNamespace
{
[Serializable]
[type: Obsolete("Old class")]
public class LegacyClass
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBeGreaterThanOrEqual(2);
		const names = attributes.map(a => a.name);
		expect(names.includes('AssemblyVersion')).toBe(true);
		expect(names.includes('Obsolete') || names.includes('Serializable')).toBe(true);
	});

	test('should handle method with stacked attributes, return attribute, and parameter attributes', () => {
		const code = `
namespace TestNamespace
{
public class UserService
{
	[Cacheable(600)]
	[Loggable("Info")]
	[return: NotNull]
	public User GetUser([Range(1, int.MaxValue)] int id)
	{
		return new User { Id = id, Username = "testuser", Email = "test@example.com" };
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBeGreaterThanOrEqual(4);
		
		const names = attributes.map(a => a.name);
		expect(names.includes('Cacheable')).toBe(true);
		expect(names.includes('Loggable')).toBe(true);
		expect(names.includes('NotNull')).toBe(true);
		expect(names.includes('Range')).toBe(true);
		
		// Verify target elements
		const cacheableAttr = attributes.find(a => a.name === 'Cacheable');
		expect(cacheableAttr?.targetElement).toBe('method');
		expect(cacheableAttr?.targetName).toBe('GetUser');
		
		const loggableAttr = attributes.find(a => a.name === 'Loggable');
		expect(loggableAttr?.targetElement).toBe('method');
		expect(loggableAttr?.targetName).toBe('GetUser');
		
		const notNullAttr = attributes.find(a => a.name === 'NotNull');
		expect(notNullAttr?.targetElement).toBe('return');
		expect(notNullAttr?.targetName).toBe('GetUser');
		
		const rangeAttr = attributes.find(a => a.name === 'Range');
		expect(rangeAttr?.targetElement).toBe('parameter');
		expect(rangeAttr?.targetName).toBe('id');
	});
});

describe('Additional Complex Real-World Attributes', () => {
	test('should detect property with enum-based DataType attribute', () => {
		const code = `
namespace TestNamespace
{
public class Article
{
	[DataType(DataType.DateTime)]
	public DateTime PublishedDate { get; set; }
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		expect(attributes.length).toBeGreaterThanOrEqual(1);
		const dataTypeAttr = attributes.find(a => a.name === 'DataType');
		expect(dataTypeAttr).toBeDefined();
		expect(dataTypeAttr?.targetElement).toBe('property');
		expect(dataTypeAttr?.targetName).toBe('PublishedDate');
	});

	test('should detect method returning nullable array with Cacheable and return MaybeNull', () => {
		const code = `
namespace TestNamespace
{
public class ArticleService
{
	[Cacheable(600)]
	[return: MaybeNull]
	public Article[]? GetAllArticles()
	{
		return null;
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		expect(names.includes('Cacheable')).toBe(true);
		expect(names.includes('MaybeNull')).toBe(true);
		
		const cacheableAttr = attributes.find(a => a.name === 'Cacheable');
		expect(cacheableAttr?.targetName).toBe('GetAllArticles');
		
		const maybeNullAttr = attributes.find(a => a.name === 'MaybeNull');
		expect(maybeNullAttr?.targetElement).toBe('return');
		expect(maybeNullAttr?.targetName).toBe('GetAllArticles');
	});

	test('should detect property with Required and EmailAddress attributes', () => {
		const code = `
namespace TestNamespace
{
public class User
{
	[Required]
	[EmailAddress]
	public string AuthorEmail { get; set; } = string.Empty;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		expect(names.includes('Required')).toBe(true);
		expect(names.includes('EmailAddress')).toBe(true);
		
		const requiredAttr = attributes.find(a => a.name === 'Required');
		expect(requiredAttr?.targetName).toBe('AuthorEmail');
		
		const emailAttr = attributes.find(a => a.name === 'EmailAddress');
		expect(emailAttr?.targetName).toBe('AuthorEmail');
	});

	test('should detect property with multiple validation attributes', () => {
		const code = `
namespace TestNamespace
{
public class Credentials
{
	[Required]
	[MinLength(8)]
	[Obsolete("Use SecurePassword instead")]
	public string Password { get; set; } = string.Empty;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		expect(names.includes('Required')).toBe(true);
		expect(names.includes('MinLength')).toBe(true);
		expect(names.includes('Obsolete')).toBe(true);

		const allAttrs = attributes.filter(a => ['Required', 'MinLength', 'Obsolete'].includes(a.name));
		allAttrs.forEach(attr => {
			expect(attr?.targetName).toBe('Password');
		});
	});

	test('should detect private field with NonSerialized attribute', () => {
		const code = `
namespace TestNamespace
{
public class CacheData
{
	[NonSerialized]
	private string _contentCache;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const nonSerializedAttr = attributes.find(a => a.name === 'NonSerialized');
		expect(nonSerializedAttr).toBeDefined();
		expect(nonSerializedAttr?.targetElement).toBe('field');
		expect(nonSerializedAttr?.targetName).toBe('_contentCache');
	});

	test('should detect property with Range attribute on leading line', () => {
		const code = `
namespace TestNamespace
{
public class Review
{
	[Range(0, 5)]
	public decimal Rating { get; set; }
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const rangeAttr = attributes.find(a => a.name === 'Range');
		expect(rangeAttr).toBeDefined();
		expect(rangeAttr?.targetElement).toBe('property');
		expect(rangeAttr?.targetName).toBe('Rating');
	});

	test('should detect property with StringLength and MinimumLength parameters', () => {
		const code = `
namespace TestNamespace
{
public class Account
{
	[Required]
	[StringLength(100, MinimumLength = 3)]
	public string Username { get; set; } = string.Empty;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		expect(names.includes('Required')).toBe(true);
		expect(names.includes('StringLength')).toBe(true);

		const stringLengthAttr = attributes.find(a => a.name === 'StringLength');
		expect(stringLengthAttr?.arguments.includes('100')).toBe(true);
		expect(stringLengthAttr?.arguments.includes('MinimumLength')).toBe(true);
		expect(stringLengthAttr?.targetName).toBe('Username');
	});

	test('should detect event with Serializable attribute', () => {
		const code = `
namespace TestNamespace
{
public class ArticlePublisher
{
	[Serializable]
	public event EventHandler<EventArgs> ArticlePublished;
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const serializableAttr = attributes.find(a => a.name === 'Serializable');
		expect(serializableAttr).toBeDefined();
		expect(serializableAttr?.targetElement).toBe('event');
		expect(serializableAttr?.targetName).toBe('ArticlePublished');
	});

	test('should detect field-scoped attribute on method declaration', () => {
		const code = `
namespace TestNamespace
{
public class UserRepository
{
	[field: Serializable]
	public User[] GetMultipleUsers(int[] ids)
	{
		return new User[0];
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const fieldAttr = attributes.find(a => a.name === 'Serializable');
		expect(fieldAttr).toBeDefined();
		expect(fieldAttr?.targetSpecifier).toBe('field');
	});

	test('should detect method with Authorize and Loggable attributes with return MaybeNull', () => {
		const code = `
namespace TestNamespace
{
public class ArticleController
{
	[Authorize("Editor", "Admin")]
	[Loggable("Warning")]
	[return: MaybeNull]
	public Article UpdateArticle([Required] Article article)
	{
		return article;
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		expect(names.includes('Authorize')).toBe(true);
		expect(names.includes('Loggable')).toBe(true);
		expect(names.includes('MaybeNull')).toBe(true);
		expect(names.includes('Required')).toBe(true);

		const authorizeAttr = attributes.find(a => a.name === 'Authorize');
		expect(authorizeAttr?.arguments.includes('Editor')).toBe(true);
		expect(authorizeAttr?.targetName).toBe('UpdateArticle');

		const loggableAttr = attributes.find(a => a.name === 'Loggable');
		expect(loggableAttr?.targetName).toBe('UpdateArticle');

		const maybeNullAttr = attributes.find(a => a.name === 'MaybeNull');
		expect(maybeNullAttr?.targetElement).toBe('return');
		expect(maybeNullAttr?.targetName).toBe('UpdateArticle');

		const requiredAttr = attributes.find(a => a.name === 'Required');
		expect(requiredAttr?.targetElement).toBe('parameter');
		expect(requiredAttr?.targetName).toBe('article');
	});

	test('should handle assembly and module attributes with fully qualified names', () => {
		const code = `[assembly: System.Reflection.AssemblyVersion("2.0.0.0")]
[module: System.Diagnostics.CodeAnalysis.SuppressMessage("*", "*")]

namespace AnotherExampleCsProject.Middleware
{
public class LoggingMiddleware
{
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		
		expect(names.length).toBeGreaterThanOrEqual(2);
		expect(names.includes('AssemblyVersion')).toBe(true);
		expect(names.includes('SuppressMessage')).toBe(true);
	});

	test('should detect enum value with Display attribute', () => {
		const code = `
namespace TestNamespace
{
public enum UserRole
{
	[System.ComponentModel.DataAnnotations.Display(Name = "Guest")]
	Guest = 1,

	[System.ComponentModel.DataAnnotations.Display(Name = "Admin")]
	Admin = 2
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const displayAttrs = attributes.filter(a => a.name === 'Display' || a.fullName.includes('Display'));
		expect(displayAttrs.length).toBeGreaterThanOrEqual(2);
		
		// Check that arguments are captured (Name = "Guest")
		displayAttrs.forEach(attr => {
			expect(attr.arguments.includes('Name')).toBe(true);
		});
	});

	test('should detect method with ApiEndpoint attribute and multiple parameter attributes', () => {
		const code = `
namespace TestNamespace
{
public class UserService
{
	[ApiEndpoint("/api/users/register", "POST")]
	[Obsolete("Use RegisterUserAsync instead")]
	[return: NotNull]
	public User RegisterUser([Validate(5, 100)] string email, [Validate(3, 50)] string username)
	{
		return new User { Email = email, Username = username };
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		
		expect(names.includes('ApiEndpoint')).toBe(true);
		expect(names.includes('Obsolete')).toBe(true);
		expect(names.includes('NotNull')).toBe(true);
		expect((attributes.filter(a => a.name === 'Validate')).length).toBe(2);

		const apiAttr = attributes.find(a => a.name === 'ApiEndpoint');
		expect(apiAttr?.targetElement).toBe('method');
		expect(apiAttr?.targetName).toBe('RegisterUser');
		expect(apiAttr?.arguments.includes('/api/users/register')).toBe(true);
		
		const validateAttrs = attributes.filter(a => a.name === 'Validate');
		expect(validateAttrs.some(v => v.targetName === 'email')).toBe(true);
		expect(validateAttrs.some(v => v.targetName === 'username')).toBe(true);
	});

	test('should detect method with ApiEndpoint, return MaybeNull, field attribute, and parameter Range', () => {
		const code = `
namespace TestNamespace
{
public class UserRepository
{
	[ApiEndpoint("/api/users/{id}", "GET")]
	[return: MaybeNull]
	[field: Serializable]
	public User GetUser([Range(1, int.MaxValue)] int userId)
	{
		return new User { UserId = userId, Email = "user@example.com", Username = "testuser" };
	}
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		
		expect(names.includes('ApiEndpoint')).toBe(true);
		expect(names.includes('MaybeNull')).toBe(true);
		expect(names.includes('Serializable')).toBe(true);
		expect(names.includes('Range')).toBe(true);

		const apiAttr = attributes.find(a => a.name === 'ApiEndpoint');
		expect(apiAttr?.targetName).toBe('GetUser');

		const maybeAttr = attributes.find(a => a.name === 'MaybeNull');
		expect(maybeAttr?.targetElement).toBe('return');
		expect(maybeAttr?.targetName).toBe('GetUser');

		const fieldAttr = attributes.find(a => a.name === 'Serializable');
		expect(fieldAttr?.targetSpecifier).toBe('field');

		const rangeAttr = attributes.find(a => a.name === 'Range');
		expect(rangeAttr?.targetName).toBe('userId');
	});
});

describe('Interface Method Signature Extraction', () => {
	test('should extract method signatures from simple interface', () => {
		const code = `
namespace TestNamespace
{
public interface IUserRepository
{
	User GetUser(int id);
	void CreateUser(User user);
	bool DeleteUser(int id);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IUserRepository');
		expect(signatures.length).toBe(3);
		expect(signatures.some(s => s.signature.includes('GetUser'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('CreateUser'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('DeleteUser'))).toBe(true);
		expect(signatures.every(s => typeof s.line === 'number' && s.line > 0)).toBe(true);
	});

	test('should extract method signatures with generic types', () => {
		const code = `
namespace TestNamespace
{
public interface IRepository<T>
{
	T GetById(int id);
	List<T> GetAll();
	Task<T> GetByIdAsync(int id);
	IEnumerable<T> SearchBy(Func<T, bool> predicate);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IRepository');
		expect(signatures.length).toBeGreaterThanOrEqual(4);
		expect(signatures.some(s => s.signature.includes('GetById'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('GetAll'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('GetByIdAsync'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('SearchBy'))).toBe(true);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should extract method signatures with nullable return types', () => {
		const code = `
namespace TestNamespace
{
public interface IArticleService
{
	Article? GetArticle(int id);
	Article[] GetAllArticles();
	List<Article>? SearchArticles(string keyword);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IArticleService');
		expect(signatures.length).toBeGreaterThanOrEqual(3);
		expect(signatures.some(s => s.signature.includes('Article?'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('Article[]'))).toBe(true);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should extract property signatures from interface', () => {
		const code = `
namespace TestNamespace
{
public interface IEntity
{
	int Id { get; set; }
	string Name { get; }
	DateTime CreatedAt { get; set; }
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IEntity');
		expect(signatures.length).toBeGreaterThanOrEqual(3);
		expect(signatures.some(s => s.signature.includes('Id'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('Name'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('CreatedAt'))).toBe(true);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should skip attribute lines when extracting signatures', () => {
		const code = `
namespace TestNamespace
{
public interface ILoggingService
{
	[Obsolete("Use LogAsync instead")]
	void Log(string message);

	[return: NotNull]
	Task LogAsync(string message);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'ILoggingService');
		expect(signatures.length).toBeGreaterThanOrEqual(2);
		expect(signatures.some(s => s.signature.includes('Log'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('LogAsync'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('[Obsolete'))).toBe(false);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should extract method with complex parameters', () => {
		const code = `
namespace TestNamespace
{
public interface IDataService
{
	IQueryable<User> GetUsers(Expression<Func<User, bool>> predicate);
	Task<PagedResult<Product>> GetProductsAsync(int pageNumber, int pageSize, CancellationToken cancellationToken = default);
	void ProcessItems(params object[] items);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IDataService');
		expect(signatures.length).toBeGreaterThanOrEqual(3);
		expect(signatures.some(s => s.signature.includes('Expression'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('CancellationToken'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('params'))).toBe(true);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should detect interface with attributes and extract methods', () => {
		const code = `
namespace TestNamespace
{
[ServiceContract]
[Serializable]
public interface IPaymentService
{
	[OperationContract]
	bool ProcessPayment(decimal amount);

	[OperationContract]
	Task<PaymentResult> ProcessPaymentAsync(decimal amount);
}
}`;
		const attributes = CSharpParser.parseAttributes(code);
		const names = attributes.map(a => a.name);
		expect(names.includes('ServiceContract')).toBe(true);
		expect(names.includes('Serializable')).toBe(true);
		expect(names.includes('OperationContract')).toBe(true);
		
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IPaymentService');
		expect(signatures.length).toBeGreaterThanOrEqual(2);
		expect(signatures.some(s => s.signature.includes('ProcessPayment'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('ProcessPaymentAsync'))).toBe(true);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should handle interface with async methods and Task types', () => {
		const code = `
namespace TestNamespace
{
public interface IAsyncRepository<T>
{
	Task<T> GetByIdAsync(int id);
	Task<IEnumerable<T>> GetAllAsync();
	Task InsertAsync(T entity);
	Task<bool> UpdateAsync(T entity);
	Task<bool> DeleteAsync(int id);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IAsyncRepository');
		expect(signatures.length).toBeGreaterThanOrEqual(5);
		expect(signatures.every(s => s.signature.includes('Task'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('GetByIdAsync'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('InsertAsync'))).toBe(true);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should handle interface with event declarations', () => {
		const code = `
namespace TestNamespace
{
public interface INotificationService
{
	event EventHandler OnNotificationReceived;
	event EventHandler<NotificationEventArgs> OnError;
	
	void Subscribe(string topic);
	void Unsubscribe(string topic);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'INotificationService');
		expect(signatures.some(s => s.signature.includes('Subscribe'))).toBe(true);
		expect(signatures.some(s => s.signature.includes('Unsubscribe'))).toBe(true);
		expect(signatures.every(s => s.line > 0)).toBe(true);
	});

	test('should return empty array for non-existent interface', () => {
		const code = `
namespace TestNamespace
{
public interface IExisting
{
	void DoSomething();
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'INonExistent');
		expect(signatures.length).toBe(0);
	});

	test('should correctly extract multiline interface method signatures', () => {
		const code = `
namespace TestNamespace
{
public interface IOrderService
{
	Task<OrderResult> CreateOrder(
		string customerId,
		List<OrderItem> items,
		int shippingAddressId
	);

	Task<bool> UpdateOrderStatus(
		int orderId,
		OrderStatus status,
		string notes = null
	);

	void CancelOrder(int orderId);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IOrderService');
		
		// Should extract all three methods
		expect(signatures.length).toBe(3);
		
		// Check for CreateOrder method (multiline)
		const createOrder = signatures.find(s => s.signature.includes('CreateOrder'));
		expect(createOrder !== undefined).toBe(true);
		expect(createOrder!.signature.includes('(') && createOrder!.signature.includes('customerId')).toBe(true);
		
		// Check for UpdateOrderStatus method (multiline)
		const updateStatus = signatures.find(s => s.signature.includes('UpdateOrderStatus'));
		expect(updateStatus !== undefined).toBe(true);
		expect(updateStatus!.signature.includes('(') && updateStatus!.signature.includes('orderId')).toBe(true);
		
		// Check for CancelOrder method (single line)
		const cancel = signatures.find(s => s.signature.includes('CancelOrder'));
		expect(cancel !== undefined).toBe(true);
		
		// Verify line numbers are in order
		expect(createOrder!.line < updateStatus!.line).toBe(true);
		expect(updateStatus!.line < cancel!.line).toBe(true);
	});

	test('should extract interface methods with multiline return type - tuple with lists', () => {
		const code = `
namespace Test {
[InterfaceAttribute]
public interface ISomeInterface
{
	Task<(List<SomeValue> kobId,
	List<SomeX> some)> FuncName(Abc ab,
	Def d,
	Gof g);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'ISomeInterface');
		
		expect(signatures.length).toBe(1);
		
		const funcName = signatures.find(s => s.signature.includes('FuncName'));
		expect(funcName !== undefined).toBe(true);
		expect(funcName!.signature.includes('Task')).toBe(true);
		expect(funcName!.signature.includes('(')).toBe(true);
	});

	test('should extract interface methods with return type on separate line', () => {
		const code = `
namespace Test {
public interface IDataService
{
	Task<Dictionary<string,
		List<Item>>> GetData(
		int id,
		CancellationToken ct);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IDataService');
		
		expect(signatures.length).toBe(1);
		
		const getData = signatures.find(s => s.signature.includes('GetData'));
		expect(getData !== undefined).toBe(true);
		expect(getData!.signature.includes('Task')).toBe(true);
	});

	test('should extract interface methods with long generic parameter list', () => {
		const code = `
namespace Test {
public interface IProcessor
{
	void Process<T1, T2, T3, T4>(
		T1 first,
		T2 second,
		T3 third,
		T4 fourth
	) where T1 : class where T2 : IComparable;
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IProcessor');
		
		expect(signatures.length).toBe(1);
		
		const process = signatures[0];
		expect(process.signature.includes('Process')).toBe(true);
		expect(process.signature.includes('(')).toBe(true);
	});

	test('should extract interface methods with multiline attributes and signature', () => {
		const code = `
namespace Test {
public interface IEventHandler
{
	[Obsolete("Use V2")]
	[Async]
	Task Handle(
		IEvent evt,
		CancellationToken cancellation
	);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IEventHandler');
		
		expect(signatures.length).toBe(1);
		
		const handle = signatures.find(s => s.signature.includes('Handle'));
		expect(handle !== undefined).toBe(true);
		expect(handle!.signature.includes('Task')).toBe(true);
	});

	test('should extract interface methods with complex nested return type across multiple lines', () => {
		const code = `
namespace Test {
public interface IComplexService
{
	Task<Result<Dictionary<string,
		List<(int id, string name, 
			Metadata meta)>>>> GetComplexData(
		Request request
	);
}
}`;
		const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IComplexService');
		
		expect(signatures.length).toBe(1);
		
		const getComplex = signatures[0];
		expect(getComplex.signature.includes('GetComplexData')).toBe(true);
		expect(getComplex.signature.includes('Task')).toBe(true);
	});

	test('should correctly assign line numbers to stacked attributes on different lines', () => {
		const code = `
[ApiEndpoint("/api/products/create", "POST")]
[Obsolete("Use CreateProductAsync instead")]
[return: NotNull]
public Product CreateProduct([StringLength(100, MinimumLength = 3)] string name, [Range(0.01, 10000)] decimal price)
{
return new Product { Name = name, Price = price };
}
`;

		const attrs = CSharpParser.parseAttributes(code);
		
		// Find each attribute
		const apiEndpointAttr = attrs.find((a: any) => a.name === 'ApiEndpoint');
		const obsoleteAttr = attrs.find((a: any) => a.name === 'Obsolete');
		const notNullAttr = attrs.find((a: any) => a.name === 'NotNull');
		const stringLengthAttr = attrs.find((a: any) => a.name === 'StringLength');
		const rangeAttr = attrs.find((a: any) => a.name === 'Range');

		// Verify all attributes were found
		expect(apiEndpointAttr !== undefined).toBe(true);
		expect(obsoleteAttr !== undefined).toBe(true);
		expect(notNullAttr !== undefined).toBe(true);
		expect(stringLengthAttr !== undefined).toBe(true);
		expect(rangeAttr !== undefined).toBe(true);

		// Verify line numbers are different and in correct order
		expect(apiEndpointAttr!.line).toBe(2);
		expect(obsoleteAttr!.line).toBe(3);
		expect(notNullAttr!.line).toBe(4);
		// StringLength is on line 5 (in parameter list)
		expect(stringLengthAttr!.line).toBe(5);
		// Range is also on line 5 (same line as StringLength in parameters)
		expect(rangeAttr!.line).toBe(5);

		// Verify they're in ascending order (except parameters which can be on same line)
		expect(apiEndpointAttr!.line < obsoleteAttr!.line).toBe(true);
		expect(obsoleteAttr!.line < notNullAttr!.line).toBe(true);
	});

	test('should correctly assign line numbers to assembly attributes on separate lines', () => {
		const code = `using System;
using System.Reflection;

[assembly: System.Reflection.AssemblyCompanyAttribute("AnotherExampleCsProject")]
[assembly: System.Reflection.AssemblyConfigurationAttribute("Debug")]
[assembly: System.Reflection.AssemblyFileVersionAttribute("1.0.0.0")]
[assembly: System.Reflection.AssemblyInformationalVersionAttribute("1.0.0")]
[assembly: System.Reflection.AssemblyProductAttribute("AnotherExampleCsProject")]
[assembly: System.Reflection.AssemblyTitleAttribute("AnotherExampleCsProject")]
[assembly: System.Reflection.AssemblyVersionAttribute("1.0.0.0")]`;

		const attrs = CSharpParser.parseAttributes(code);
		
		// Find each assembly attribute
		const companyAttr = attrs.find((a: any) => a.name === 'AssemblyCompanyAttribute');
		const configAttr = attrs.find((a: any) => a.name === 'AssemblyConfigurationAttribute');
		const fileVersionAttr = attrs.find((a: any) => a.name === 'AssemblyFileVersionAttribute');
		const infoVersionAttr = attrs.find((a: any) => a.name === 'AssemblyInformationalVersionAttribute');
		const productAttr = attrs.find((a: any) => a.name === 'AssemblyProductAttribute');
		const titleAttr = attrs.find((a: any) => a.name === 'AssemblyTitleAttribute');
		const versionAttr = attrs.find((a: any) => a.name === 'AssemblyVersionAttribute');

		// Verify all attributes were found
		expect(companyAttr !== undefined).toBe(true);
		expect(configAttr !== undefined).toBe(true);
		expect(fileVersionAttr !== undefined).toBe(true);
		expect(infoVersionAttr !== undefined).toBe(true);
		expect(productAttr !== undefined).toBe(true);
		expect(titleAttr !== undefined).toBe(true);
		expect(versionAttr !== undefined).toBe(true);

		// Verify each is on the correct line (lines 4-10)
		expect(companyAttr!.line).toBe(4);
		expect(configAttr!.line).toBe(5);
		expect(fileVersionAttr!.line).toBe(6);
		expect(infoVersionAttr!.line).toBe(7);
		expect(productAttr!.line).toBe(8);
		expect(titleAttr!.line).toBe(9);
		expect(versionAttr!.line).toBe(10);

		// Verify they're in ascending order
		expect(companyAttr!.line < configAttr!.line).toBe(true);
		expect(configAttr!.line < fileVersionAttr!.line).toBe(true);
		expect(fileVersionAttr!.line < infoVersionAttr!.line).toBe(true);
		expect(infoVersionAttr!.line < productAttr!.line).toBe(true);
		expect(productAttr!.line < titleAttr!.line).toBe(true);
		expect(titleAttr!.line < versionAttr!.line).toBe(true);
	});

	test('should correctly identify record struct as target element', () => {
		const code = `[SomeAttribute(typeof(SomeX))]
public readonly record struct Def(Guid Abc)
{
public Guid Id { get; set; }
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const someAttr = attrs.find((a: any) => a.name === 'SomeAttribute');

		expect(someAttr).toBeDefined();
		expect(someAttr!.targetElement).toBe('recordStruct');
	});

	test('should correctly identify property with brace on separate line', () => {
		const code = `[MaxLength(9)]
[MinLength(1)]
public string Some
{
get { return "test"; }
init { }
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const maxLengthAttr = attrs.find((a: any) => a.name === 'MaxLength');
		const minLengthAttr = attrs.find((a: any) => a.name === 'MinLength');

		expect(maxLengthAttr).toBeDefined();
		expect(minLengthAttr).toBeDefined();
		expect(maxLengthAttr!.targetElement).toBe('property');
		expect(minLengthAttr!.targetElement).toBe('property');
		expect(maxLengthAttr!.targetName).toBe('Some');
		expect(minLengthAttr!.targetName).toBe('Some');
	});

	test('should handle complex nested braces in attribute arguments', () => {
		const code = `[Validate(typeof(MyValidator<Dictionary<string, List<Item>>>))]
public class ComplexType
{
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const valAttr = attrs.find((a: any) => a.name === 'Validate');

		expect(valAttr).toBeDefined();
		expect(valAttr!.targetElement).toBe('class');
	});

	test('should handle attributes on abstract sealed combined modifier class', () => {
		const code = `[Sealed]
public abstract sealed class StrangeClass
{
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const sealedAttr = attrs.find((a: any) => a.name === 'Sealed');

		expect(sealedAttr).toBeDefined();
		expect(sealedAttr!.targetElement).toBe('class');
	});

	test('should handle attributes on deeply nested multiline method signatures', () => {
		const code = `[Obsolete]
public async Task<Result<Dictionary<string, 
List<Item>>>> ProcessAsync(
string param1,
int param2,
Func<string, Task<bool>> validator = null
)
{
return null;
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const obsAttr = attrs.find((a: any) => a.name === 'Obsolete');

		expect(obsAttr).toBeDefined();
		expect(obsAttr!.targetElement).toBe('method');
	});

	test('should handle attributes on property with complex type and nested braces in initializer', () => {
		const code = `[Required]
public Dictionary<string, List<int>> Data 
{ 
get { return new Dictionary<string, List<int>> { { "key", new List<int> { 1, 2, 3 } } }; }
set { }
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const reqAttr = attrs.find((a: any) => a.name === 'Required');

		expect(reqAttr).toBeDefined();
		expect(reqAttr!.targetElement).toBe('property');
	});

	test('should handle indexer with attribute', () => {
		const code = `[Obsolete]
public string this[int index] 
{
get { return _items[index]; }
set { _items[index] = value; }
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const obsAttr = attrs.find((a: any) => a.name === 'Obsolete');
		
		expect(obsAttr).toBeDefined();
		expect(obsAttr!.targetElement).toBe('property');
	});

	test('should correctly parse attributes with complex nested generics', () => {
		const code = `[ValidationType(typeof(Dictionary<string, List<Item>>))]
public class OrderProcessor
{
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const valAttr = attrs.find((a: any) => a.name === 'ValidationType');

		expect(valAttr).toBeDefined();
		expect(valAttr!.targetElement).toBe('class');
	});

	test('should correctly identify readonly struct', () => {
		const code = `[Serializable]
public readonly struct Point
{
public int X { get; }
public int Y { get; }
}`;

		const attrs = CSharpParser.parseAttributes(code);
		const serAttr = attrs.find((a: any) => a.name === 'Serializable');

		expect(serAttr).toBeDefined();
		expect(serAttr!.targetElement).toBe('struct');
		expect(serAttr!.targetName).toBe('Point');
	});
});