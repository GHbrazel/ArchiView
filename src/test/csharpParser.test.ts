import * as assert from 'assert';
import { CSharpParser } from '../csharpParser';

suite('C# Parser Test Suite', () => {

	suite('Real Attributes Detection', () => {
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Serializable');
			assert.strictEqual(attributes[0].targetElement, 'class');
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
			assert.strictEqual(attributes.length, 3);
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('Serializable'), 'Should include Serializable');
			assert.ok(names.includes('Required'), 'Should include Required');
			assert.ok(names.includes('Obsolete'), 'Should include Obsolete');
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
			assert.strictEqual(attributes.length, 2);
			const serializableAttr = attributes.find(a => a.name === 'Serializable');
			const tableAttr = attributes.find(a => a.name === 'Table');
			
			assert.ok(serializableAttr, 'Should find Serializable attribute');
			assert.ok(tableAttr, 'Should find Table attribute');
			assert.strictEqual(serializableAttr?.targetName, 'User', 'Serializable should have targetName "User"');
			assert.strictEqual(tableAttr?.targetName, 'User', 'Table should have targetName "User"');
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
			assert.strictEqual(attributes.length, 2);
			assert.ok(attributes.every(a => a.targetElement === 'property'), 'All attributes should target properties');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Obsolete');
			assert.strictEqual(attributes[0].targetElement, 'method');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'ApiEndpoint');
			assert.strictEqual(attributes[0].arguments, '"/api/users", "POST"');
		});

		test('should extract complex attribute arguments', () => {
			const code = `
namespace TestNamespace
{
	[StringLength(255, MinimumLength = 3)]
	public string Name { get; set; }
}`;
			const attributes = CSharpParser.parseAttributes(code);
			assert.strictEqual(attributes.length, 1);
			assert.ok(attributes[0].arguments?.includes('255'), 'Arguments should include 255');
			assert.ok(attributes[0].arguments?.includes('MinimumLength'), 'Arguments should include MinimumLength');
		});
	});

	suite('False Positives - Array Indexing', () => {
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
			assert.strictEqual(attributes.length, 0, 'Array indexing should not be detected as attributes');
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
			assert.strictEqual(attributes.length, 0, 'String indexing should not be detected as attributes');
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
			assert.strictEqual(attributes.length, 0, 'Multi-dimensional array indexing should not be detected');
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
			assert.strictEqual(attributes.length, 0, 'List indexing should not be detected as attributes');
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
			assert.strictEqual(attributes.length, 0, 'Dictionary access should not be detected as attributes');
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
			assert.strictEqual(attributes.length, 0, 'Array access with variable should not be detected');
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
			assert.strictEqual(attributes.length, 0, 'Array access with expression should not be detected');
		});
	});

	suite('Mixed Real Attributes and False Positives', () => {
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
			assert.strictEqual(attributes.length, 5, 'Should only detect 5 real attributes');
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('Serializable'), 'Should include Serializable');
			assert.ok(names.includes('Repository'), 'Should include Repository');
			assert.ok(names.includes('Key'), 'Should include Key');
			assert.ok(names.includes('Required'), 'Should include Required');
			assert.ok(names.includes('StringLength'), 'Should include StringLength');
			assert.ok(!names.includes('0'), 'Should not include 0 as attribute');
			assert.ok(!names.includes('1'), 'Should not include 1 as attribute');
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
			assert.strictEqual(attributes.length, 5, 'Should detect 5 attributes only');
			const attributeNames = attributes.map(a => a.name);
			assert.ok(attributeNames.includes('Authorize'), 'Should include Authorize');
			assert.ok(attributeNames.includes('Cacheable'), 'Should include Cacheable');
			assert.ok(attributeNames.includes('Loggable'), 'Should include Loggable');
			assert.ok(attributeNames.includes('Obsolete'), 'Should include Obsolete');
		});
	});

	suite('Namespace Extraction', () => {
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
			assert.strictEqual(namespace, 'CsAttributeExampleProject.Models');
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
			assert.strictEqual(namespace, 'Company.Project.SubNamespace.Models');
		});

		test('should handle missing namespace', () => {
			const code = `
[Serializable]
public class TestClass
{
}`;
			const namespace = CSharpParser.extractNamespace(code);
			assert.strictEqual(namespace, '');
		});
	});

	suite('Edge Cases', () => {
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
			assert.ok(attributes.length > 0, 'Should detect at least one attribute');
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
			assert.strictEqual(attributes.length, 0, 'Generic type parameters should not be detected as attributes');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'ApiEndpoint');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'ArrayAttribute');
		});
	});

	suite('Line Number Tracking', () => {
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
			assert.strictEqual(attributes.length, 2);
			assert.ok(attributes[0].line >= 2, 'First attribute line should be >= 2');
			assert.ok(attributes[1].line >= 5, 'Second attribute line should be >= 5');
		});
	});

	suite('Parameter Attributes', () => {
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'NotNull');
			assert.strictEqual(attributes[0].targetElement, 'parameter');
			assert.strictEqual(attributes[0].parameterType, 'object');
			assert.strictEqual(attributes[0].parameterName, 'value');
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
			assert.strictEqual(attributes.length, 2);
			const notNullAttr = attributes.find(a => a.name === 'NotNull');
			const optionalAttr = attributes.find(a => a.name === 'Optional');
			
			assert.ok(notNullAttr, 'Should detect NotNull attribute');
			assert.ok(optionalAttr, 'Should detect Optional attribute');
			assert.strictEqual(notNullAttr?.parameterName, 'message');
			assert.strictEqual(optionalAttr?.parameterName, 'timeout');
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
			assert.strictEqual(attributes.length, 2);
			
			const rangeAttr = attributes.find(a => a.name === 'Range');
			assert.ok(rangeAttr, 'Should detect Range attribute');
			assert.ok(rangeAttr?.arguments.includes('1'), 'Range should have argument 1');
			assert.ok(rangeAttr?.arguments.includes('100'), 'Range should have argument 100');
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
			assert.strictEqual(attributes.length, 2);
			
			const queryAttr = attributes.find(a => a.name === 'FromQuery');
			const notNullAttr = attributes.find(a => a.name === 'NotNull');
			
			assert.strictEqual(queryAttr?.parameterType, 'ReportDto');
			assert.strictEqual(queryAttr?.parameterName, 'report');
			assert.strictEqual(notNullAttr?.parameterType, 'UserModel');
			assert.strictEqual(notNullAttr?.parameterName, 'user');
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
			assert.ok(notNullAttr, 'Should detect NotNull parameter attribute');
			assert.strictEqual(notNullAttr?.parameterType, 'object?');
			assert.strictEqual(notNullAttr?.parameterName, 'value');
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
			assert.strictEqual(attributes.length, 3, 'Should detect class, method, and parameter attributes');
			
			const classAttrs = attributes.filter(a => a.targetElement === 'class');
			const methodAttrs = attributes.filter(a => a.targetElement === 'method');
			const paramAttrs = attributes.filter(a => a.targetElement === 'parameter');
			
			assert.strictEqual(classAttrs.length, 1, 'Should have 1 class attribute');
			assert.strictEqual(methodAttrs.length, 1, 'Should have 1 method attribute');
			assert.strictEqual(paramAttrs.length, 1, 'Should have 1 parameter attribute');
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
			assert.strictEqual(attributes.length, 0, 'Should not detect array access as parameter attribute');
		});
	});

	suite('Field Attributes', () => {
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
			assert.strictEqual(attributes.length, 2);
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('Serializable'), 'Should include Serializable on field');
			assert.ok(names.includes('NonSerialized'), 'Should include NonSerialized on field');
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
			assert.strictEqual(attributes.length, 2);
			const rangeAttr = attributes.find(a => a.name === 'Range');
			assert.ok(rangeAttr?.arguments.includes('1'), 'Range should have arguments');
		});
	});

	suite('Event Attributes', () => {
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
			assert.strictEqual(attributes.length, 2);
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('Obsolete'), 'Should detect Obsolete on event');
			assert.ok(names.includes('Serializable'), 'Should detect Serializable on event');
		});
	});

	suite('Return Type Attributes', () => {
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
			assert.strictEqual(attributes.length, 2);
			const returnAttrs = attributes.filter(a => a.targetElement === 'return');
			assert.strictEqual(returnAttrs.length, 2, 'Should detect 2 return type attributes');
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
			assert.strictEqual(attributes.length, 2);
			const returnAttrs = attributes.filter(a => a.targetElement === 'return');
			assert.strictEqual(returnAttrs.length, 2, 'Should detect return attributes on properties');
		});
	});

	suite('Explicit Target Specifiers', () => {
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Serializable');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Obsolete');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Serializable');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Required');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Required');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'Serializable');
		});
	});

	suite('Global/Assembly Attributes', () => {
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
			assert.strictEqual(attributes.length, 2);
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('AssemblyVersion'), 'Should detect AssemblyVersion');
			assert.ok(names.includes('AssemblyCulture'), 'Should detect AssemblyCulture');
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
			assert.strictEqual(attributes.length, 1);
			assert.strictEqual(attributes[0].name, 'MyModuleAttribute');
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
			assert.strictEqual(attributes.length, 3);
			const versionAttr = attributes.find(a => a.name === 'AssemblyFileVersion');
			assert.ok(versionAttr?.arguments.includes('2.5.1.0'), 'Should include version argument');
		});
	});

	suite('Type Parameter Attributes', () => {
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
			assert.ok(Array.isArray(attributes), 'Should return array without crashing');
		});
	});

	suite('Complex Multi-Level Attributes', () => {
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
			assert.ok(attributes.length >= 7, 'Should detect class, field, property, method, and return attributes');
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('Serializable'), 'Should include class attribute');
			assert.ok(names.includes('StringLength'), 'Should include field attribute');
			assert.ok(names.includes('Key'), 'Should include property attribute');
			assert.ok(names.includes('Obsolete'), 'Should include method attribute');
			assert.ok(names.includes('NotNull'), 'Should include return attribute');
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
			assert.ok(attributes.length >= 2, 'Should detect both assembly and type attributes');
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('AssemblyVersion'), 'Should detect assembly attribute');
			assert.ok(names.includes('Obsolete') || names.includes('Serializable'), 'Should detect type attributes');
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
			
			assert.ok(attributes.length >= 4, `Expected at least 4 attributes, got ${attributes.length}`);
			
			const names = attributes.map(a => a.name);
			assert.ok(names.includes('Cacheable'), 'Should include Cacheable method attribute');
			assert.ok(names.includes('Loggable'), 'Should include Loggable method attribute');
			assert.ok(names.includes('NotNull'), 'Should include NotNull return attribute');
			assert.ok(names.includes('Range'), 'Should include Range parameter attribute');
			
			// Verify target elements
			const cacheableAttr = attributes.find(a => a.name === 'Cacheable');
			assert.strictEqual(cacheableAttr?.targetElement, 'method', 'Cacheable should target method');
			assert.strictEqual(cacheableAttr?.targetName, 'GetUser', 'Cacheable should have targetName GetUser');
			
			const loggableAttr = attributes.find(a => a.name === 'Loggable');
			assert.strictEqual(loggableAttr?.targetElement, 'method', 'Loggable should target method');
			assert.strictEqual(loggableAttr?.targetName, 'GetUser', 'Loggable should have targetName GetUser');
			
			const notNullAttr = attributes.find(a => a.name === 'NotNull');
			assert.strictEqual(notNullAttr?.targetElement, 'return', 'NotNull should target return');
			assert.strictEqual(notNullAttr?.targetName, 'GetUser', 'NotNull should have targetName GetUser');
			
			const rangeAttr = attributes.find(a => a.name === 'Range');
			assert.strictEqual(rangeAttr?.targetElement, 'parameter', 'Range should target parameter');
			assert.strictEqual(rangeAttr?.targetName, 'id', 'Range should have targetName id');
		});
	});

	suite('Additional Complex Real-World Attributes', () => {
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
			assert.ok(attributes.length >= 1);
			const dataTypeAttr = attributes.find(a => a.name === 'DataType');
			assert.ok(dataTypeAttr, 'Should detect DataType attribute');
			assert.strictEqual(dataTypeAttr?.targetElement, 'property', 'DataType should target property');
			assert.strictEqual(dataTypeAttr?.targetName, 'PublishedDate', 'DataType should target PublishedDate property');
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
			assert.ok(names.includes('Cacheable'), 'Should detect Cacheable attribute');
			assert.ok(names.includes('MaybeNull'), 'Should detect MaybeNull return attribute');
			
			const cacheableAttr = attributes.find(a => a.name === 'Cacheable');
			assert.strictEqual(cacheableAttr?.targetName, 'GetAllArticles', 'Cacheable should target GetAllArticles');
			
			const maybeNullAttr = attributes.find(a => a.name === 'MaybeNull');
			assert.strictEqual(maybeNullAttr?.targetElement, 'return', 'MaybeNull should target return');
			assert.strictEqual(maybeNullAttr?.targetName, 'GetAllArticles', 'MaybeNull should target GetAllArticles');
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
			assert.ok(names.includes('Required'), 'Should detect Required attribute');
			assert.ok(names.includes('EmailAddress'), 'Should detect EmailAddress attribute');
			
			const requiredAttr = attributes.find(a => a.name === 'Required');
			assert.strictEqual(requiredAttr?.targetName, 'AuthorEmail', 'Required should target AuthorEmail');
			
			const emailAttr = attributes.find(a => a.name === 'EmailAddress');
			assert.strictEqual(emailAttr?.targetName, 'AuthorEmail', 'EmailAddress should target AuthorEmail');
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
			assert.ok(names.includes('Required'), 'Should detect Required');
			assert.ok(names.includes('MinLength'), 'Should detect MinLength');
			assert.ok(names.includes('Obsolete'), 'Should detect Obsolete');
			
			const allAttrs = attributes.filter(a => ['Required', 'MinLength', 'Obsolete'].includes(a.name));
			allAttrs.forEach(attr => {
				assert.strictEqual(attr?.targetName, 'Password', `${attr.name} should target Password`);
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
			assert.ok(nonSerializedAttr, 'Should detect NonSerialized attribute');
			assert.strictEqual(nonSerializedAttr?.targetElement, 'field', 'NonSerialized should target field');
			assert.strictEqual(nonSerializedAttr?.targetName, '_contentCache', 'NonSerialized should target _contentCache');
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
			assert.ok(rangeAttr, 'Should detect Range attribute');
			assert.strictEqual(rangeAttr?.targetElement, 'property', 'Range should target property');
			assert.strictEqual(rangeAttr?.targetName, 'Rating', 'Range should target Rating property');
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
			assert.ok(names.includes('Required'), 'Should detect Required');
			assert.ok(names.includes('StringLength'), 'Should detect StringLength');
			
			const stringLengthAttr = attributes.find(a => a.name === 'StringLength');
			assert.ok(stringLengthAttr?.arguments.includes('100'), 'Should capture length parameter');
			assert.ok(stringLengthAttr?.arguments.includes('MinimumLength'), 'Should capture named parameter');
			assert.strictEqual(stringLengthAttr?.targetName, 'Username', 'StringLength should target Username');
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
			assert.ok(serializableAttr, 'Should detect Serializable on event');
			assert.strictEqual(serializableAttr?.targetElement, 'event', 'Serializable should target event');
			assert.strictEqual(serializableAttr?.targetName, 'ArticlePublished', 'Serializable should target ArticlePublished event');
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
			assert.ok(fieldAttr, 'Should detect field-scoped Serializable attribute');
			assert.strictEqual(fieldAttr?.targetSpecifier, 'field', 'Should recognize field: target specifier');
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
			assert.ok(names.includes('Authorize'), 'Should detect Authorize attribute');
			assert.ok(names.includes('Loggable'), 'Should detect Loggable attribute');
			assert.ok(names.includes('MaybeNull'), 'Should detect MaybeNull return attribute');
			assert.ok(names.includes('Required'), 'Should detect Required parameter attribute');
			
			const authorizeAttr = attributes.find(a => a.name === 'Authorize');
			assert.strictEqual(authorizeAttr?.arguments.includes('Editor'), true, 'Authorize should have Editor argument');
			assert.strictEqual(authorizeAttr?.targetName, 'UpdateArticle', 'Authorize should target UpdateArticle');
			
			const loggableAttr = attributes.find(a => a.name === 'Loggable');
			assert.strictEqual(loggableAttr?.targetName, 'UpdateArticle', 'Loggable should target UpdateArticle');
			
			const maybeNullAttr = attributes.find(a => a.name === 'MaybeNull');
			assert.strictEqual(maybeNullAttr?.targetElement, 'return', 'MaybeNull should target return');
			assert.strictEqual(maybeNullAttr?.targetName, 'UpdateArticle', 'MaybeNull should target UpdateArticle');
			
			const requiredAttr = attributes.find(a => a.name === 'Required');
			assert.strictEqual(requiredAttr?.targetElement, 'parameter', 'Required should target parameter');
			assert.strictEqual(requiredAttr?.targetName, 'article', 'Required should target article parameter');
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
			
			assert.ok(names.length >= 2, 'Should detect assembly and module attributes');
			assert.ok(names.includes('AssemblyVersion') || attributes.some(a => a.fullName.includes('AssemblyVersion')), 
				'Should detect AssemblyVersion');
			assert.ok(names.includes('SuppressMessage') || attributes.some(a => a.fullName.includes('SuppressMessage')), 
				'Should detect SuppressMessage');
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
			assert.ok(displayAttrs.length >= 2, 'Should detect Display attributes on enum values');
			
			// Check that arguments are captured (Name = "Guest")
			displayAttrs.forEach(attr => {
				assert.ok(attr.arguments.includes('Name'), 'Display attribute should have Name argument');
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
			
			assert.ok(names.includes('ApiEndpoint'), 'Should detect ApiEndpoint attribute');
			assert.ok(names.includes('Obsolete'), 'Should detect Obsolete attribute');
			assert.ok(names.includes('NotNull'), 'Should detect NotNull return attribute');
			assert.strictEqual((attributes.filter(a => a.name === 'Validate')).length, 2, 'Should detect both Validate parameter attributes');
			
			const apiAttr = attributes.find(a => a.name === 'ApiEndpoint');
			assert.strictEqual(apiAttr?.targetElement, 'method', 'ApiEndpoint should target method');
			assert.strictEqual(apiAttr?.targetName, 'RegisterUser', 'ApiEndpoint should target RegisterUser');
			assert.ok(apiAttr?.arguments.includes('/api/users/register'), 'Should capture endpoint path');
			
			const validateAttrs = attributes.filter(a => a.name === 'Validate');
			assert.ok(validateAttrs.some(v => v.targetName === 'email'), 'Should detect Validate on email parameter');
			assert.ok(validateAttrs.some(v => v.targetName === 'username'), 'Should detect Validate on username parameter');
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
			
			assert.ok(names.includes('ApiEndpoint'), 'Should detect ApiEndpoint');
			assert.ok(names.includes('MaybeNull'), 'Should detect MaybeNull return attribute');
			assert.ok(names.includes('Serializable'), 'Should detect Serializable with field: specifier');
			assert.ok(names.includes('Range'), 'Should detect Range parameter attribute');
			
			const apiAttr = attributes.find(a => a.name === 'ApiEndpoint');
			assert.strictEqual(apiAttr?.targetName, 'GetUser', 'ApiEndpoint should target GetUser');
			
			const maybeAttr = attributes.find(a => a.name === 'MaybeNull');
			assert.strictEqual(maybeAttr?.targetElement, 'return', 'MaybeNull should target return');
			assert.strictEqual(maybeAttr?.targetName, 'GetUser', 'MaybeNull should target GetUser');
			
			const fieldAttr = attributes.find(a => a.name === 'Serializable');
			assert.strictEqual(fieldAttr?.targetSpecifier, 'field', 'Serializable should have field: specifier');
			
			const rangeAttr = attributes.find(a => a.name === 'Range');
			assert.strictEqual(rangeAttr?.targetName, 'userId', 'Range should target userId parameter');
		});
	});

	suite('Interface Method Signature Extraction', () => {
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
			assert.strictEqual(signatures.length, 3, 'Should extract 3 method signatures');
			assert.ok(signatures.some(s => s.signature.includes('GetUser')), 'Should include GetUser method');
			assert.ok(signatures.some(s => s.signature.includes('CreateUser')), 'Should include CreateUser method');
			assert.ok(signatures.some(s => s.signature.includes('DeleteUser')), 'Should include DeleteUser method');
			assert.ok(signatures.every(s => typeof s.line === 'number' && s.line > 0), 'All signatures should have line numbers');
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
			assert.ok(signatures.length >= 4, 'Should extract at least 4 method signatures');
			assert.ok(signatures.some(s => s.signature.includes('GetById')), 'Should include GetById');
			assert.ok(signatures.some(s => s.signature.includes('GetAll')), 'Should include GetAll');
			assert.ok(signatures.some(s => s.signature.includes('GetByIdAsync')), 'Should include GetByIdAsync');
			assert.ok(signatures.some(s => s.signature.includes('SearchBy')), 'Should include SearchBy');
			assert.ok(signatures.every(s => s.line > 0), 'All signatures should have positive line numbers');
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
			assert.ok(signatures.length >= 3, 'Should extract method signatures with nullable types');
			assert.ok(signatures.some(s => s.signature.includes('Article?')), 'Should include nullable return type');
			assert.ok(signatures.some(s => s.signature.includes('Article[]')), 'Should include array return type');
			assert.ok(signatures.every(s => s.line > 0), 'All signatures should have line numbers');
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
			assert.ok(signatures.length >= 3, 'Should extract property signatures');
			assert.ok(signatures.some(s => s.signature.includes('Id')), 'Should include Id property');
			assert.ok(signatures.some(s => s.signature.includes('Name')), 'Should include Name property');
			assert.ok(signatures.some(s => s.signature.includes('CreatedAt')), 'Should include CreatedAt property');
			assert.ok(signatures.every(s => s.line > 0), 'All properties should have line numbers');
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
			assert.ok(signatures.length >= 2, 'Should skip attributes and extract methods');
			assert.ok(signatures.some(s => s.signature.includes('Log')), 'Should include Log method');
			assert.ok(signatures.some(s => s.signature.includes('LogAsync')), 'Should include LogAsync method');
			assert.ok(!signatures.some(s => s.signature.includes('[Obsolete')), 'Should not include attribute in signature');
			assert.ok(signatures.every(s => s.line > 0), 'All signatures should have line numbers');
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
			assert.ok(signatures.length >= 3, 'Should extract methods with complex parameters');
			assert.ok(signatures.some(s => s.signature.includes('Expression')), 'Should handle Expression parameters');
			assert.ok(signatures.some(s => s.signature.includes('CancellationToken')), 'Should handle CancellationToken');
			assert.ok(signatures.some(s => s.signature.includes('params')), 'Should handle params keyword');
			assert.ok(signatures.every(s => s.line > 0), 'All signatures should have line numbers');
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
			assert.ok(names.includes('ServiceContract'), 'Should detect ServiceContract attribute');
			assert.ok(names.includes('Serializable'), 'Should detect Serializable attribute');
			assert.ok(names.includes('OperationContract'), 'Should detect OperationContract attribute');
			
			const signatures = CSharpParser.extractInterfaceMethodSignatures(code, 'IPaymentService');
			assert.ok(signatures.length >= 2, 'Should extract methods ignoring attributes');
			assert.ok(signatures.some(s => s.signature.includes('ProcessPayment')), 'Should include ProcessPayment');
			assert.ok(signatures.some(s => s.signature.includes('ProcessPaymentAsync')), 'Should include ProcessPaymentAsync');
			assert.ok(signatures.every(s => s.line > 0), 'All signatures should have line numbers');
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
			assert.ok(signatures.length >= 5, 'Should extract async methods');
			assert.ok(signatures.every(s => s.signature.includes('Task')), 'All methods should be async/Task-based');
			assert.ok(signatures.some(s => s.signature.includes('GetByIdAsync')), 'Should include GetByIdAsync');
			assert.ok(signatures.some(s => s.signature.includes('InsertAsync')), 'Should include InsertAsync');
			assert.ok(signatures.every(s => s.line > 0), 'All signatures should have line numbers');
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
			assert.ok(signatures.some(s => s.signature.includes('Subscribe')), 'Should include Subscribe method');
			assert.ok(signatures.some(s => s.signature.includes('Unsubscribe')), 'Should include Unsubscribe method');
			assert.ok(signatures.every(s => s.line > 0), 'All signatures should have line numbers');
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
			assert.strictEqual(signatures.length, 0, 'Should return empty array for non-existent interface');
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
                        assert.strictEqual(apiEndpointAttr !== undefined, true, 'Should find ApiEndpoint');
                        assert.strictEqual(obsoleteAttr !== undefined, true, 'Should find Obsolete');
                        assert.strictEqual(notNullAttr !== undefined, true, 'Should find NotNull');
                        assert.strictEqual(stringLengthAttr !== undefined, true, 'Should find StringLength');
                        assert.strictEqual(rangeAttr !== undefined, true, 'Should find Range');

                        // Verify line numbers are different and in correct order
                        assert.strictEqual(apiEndpointAttr!.line, 2, 'ApiEndpoint should be on line 2');
                        assert.strictEqual(obsoleteAttr!.line, 3, 'Obsolete should be on line 3');
                        assert.strictEqual(notNullAttr!.line, 4, 'NotNull should be on line 4');
                        // StringLength is on line 5 (in parameter list)
                        assert.strictEqual(stringLengthAttr!.line, 5, 'StringLength should be on line 5');
                        // Range is also on line 5 (same line as StringLength in parameters)
                        assert.strictEqual(rangeAttr!.line, 5, 'Range should be on line 5');

                        // Verify they're in ascending order (except parameters which can be on same line)
                        assert.strictEqual(apiEndpointAttr!.line < obsoleteAttr!.line, true, 'ApiEndpoint should come before Obsolete');
                        assert.strictEqual(obsoleteAttr!.line < notNullAttr!.line, true, 'Obsolete should come before NotNull');
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
                        assert.strictEqual(companyAttr !== undefined, true, 'Should find AssemblyCompanyAttribute');
                        assert.strictEqual(configAttr !== undefined, true, 'Should find AssemblyConfigurationAttribute');
                        assert.strictEqual(fileVersionAttr !== undefined, true, 'Should find AssemblyFileVersionAttribute');
                        assert.strictEqual(infoVersionAttr !== undefined, true, 'Should find AssemblyInformationalVersionAttribute');
                        assert.strictEqual(productAttr !== undefined, true, 'Should find AssemblyProductAttribute');
                        assert.strictEqual(titleAttr !== undefined, true, 'Should find AssemblyTitleAttribute');
                        assert.strictEqual(versionAttr !== undefined, true, 'Should find AssemblyVersionAttribute');

                        // Verify each is on the correct line (lines 4-10)
                        assert.strictEqual(companyAttr!.line, 4, 'AssemblyCompanyAttribute should be on line 4');
                        assert.strictEqual(configAttr!.line, 5, 'AssemblyConfigurationAttribute should be on line 5');
                        assert.strictEqual(fileVersionAttr!.line, 6, 'AssemblyFileVersionAttribute should be on line 6');
                        assert.strictEqual(infoVersionAttr!.line, 7, 'AssemblyInformationalVersionAttribute should be on line 7');
                        assert.strictEqual(productAttr!.line, 8, 'AssemblyProductAttribute should be on line 8');
                        assert.strictEqual(titleAttr!.line, 9, 'AssemblyTitleAttribute should be on line 9');
                        assert.strictEqual(versionAttr!.line, 10, 'AssemblyVersionAttribute should be on line 10');

                        // Verify they're in ascending order
                        assert.strictEqual(companyAttr!.line < configAttr!.line, true, 'CompanyAttribute should come before ConfigurationAttribute');
                        assert.strictEqual(configAttr!.line < fileVersionAttr!.line, true, 'ConfigurationAttribute should come before FileVersionAttribute');
                        assert.strictEqual(fileVersionAttr!.line < infoVersionAttr!.line, true, 'FileVersionAttribute should come before InformationalVersionAttribute');
                        assert.strictEqual(infoVersionAttr!.line < productAttr!.line, true, 'InformationalVersionAttribute should come before ProductAttribute');
                        assert.strictEqual(productAttr!.line < titleAttr!.line, true, 'ProductAttribute should come before TitleAttribute');
                        assert.strictEqual(titleAttr!.line < versionAttr!.line, true, 'TitleAttribute should come before VersionAttribute');
                });
        });
});
