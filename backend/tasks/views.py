from rest_framework import viewsets, filters
from rest_framework.decorators import action
from rest_framework.response import Response
from .models import Task
from .serializers import TaskSerializer


class TaskViewSet(viewsets.ModelViewSet):
    queryset = Task.objects.all()
    serializer_class = TaskSerializer
    filter_backends = [filters.SearchFilter, filters.OrderingFilter]
    search_fields = ['title', 'description']
    ordering_fields = ['created_at', 'priority', 'title']

    def get_queryset(self):
        queryset = Task.objects.all()
        completed = self.request.query_params.get('completed')
        priority = self.request.query_params.get('priority')

        if completed is not None:
            queryset = queryset.filter(completed=completed.lower() == 'true')
        if priority:
            queryset = queryset.filter(priority=priority)

        return queryset

    @action(detail=False, methods=['get'])
    def stats(self, request):
        total = Task.objects.count()
        completed = Task.objects.filter(completed=True).count()
        by_priority = {
            'high': Task.objects.filter(priority='high', completed=False).count(),
            'medium': Task.objects.filter(priority='medium', completed=False).count(),
            'low': Task.objects.filter(priority='low', completed=False).count(),
        }
        return Response({
            'total': total,
            'completed': completed,
            'pending': total - completed,
            'by_priority': by_priority,
        })
