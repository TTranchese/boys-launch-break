using BuberDinner.Domain.Common.Models;
using BuberDinner.Domain.Menu.Entities;
using BuberDinner.Domain.Menu.ValueObjects;

namespace BuberDinner.Domain.Menu
{
    public sealed class Menu : AggregateRoot<MenuSectionId>
    {
        private readonly List<MenuSection> _sections = new ();
        public string Name { get; }
        public string Descripotion { get; }
        public float AvarageRating { get; }
        public IReadOnlyList<MenuSection> Sections => _sections.AsReadOnly();
        public Menu(MenuSectionId id) : base(id)
        {
        }
    }
}

