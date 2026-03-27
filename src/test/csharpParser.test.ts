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
			// Ensure no "0" or "1" attributes
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
			// Real attributes
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
			// Should detect the attribute (may or may not handle generic syntax perfectly, but shouldn't crash)
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
			// Line numbers should be tracked (starting from 0 or 1 depending on implementation)
			assert.ok(attributes[0].line >= 2, 'First attribute line should be >= 2');
			assert.ok(attributes[1].line >= 5, 'Second attribute line should be >= 5');
		});
	});
});
